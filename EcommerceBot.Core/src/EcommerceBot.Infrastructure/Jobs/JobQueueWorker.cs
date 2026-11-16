namespace EcommerceBot.Infrastructure.Jobs;

using System.Threading.Channels;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Infrastructure.Options;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

/// <summary>
/// Worker de segundo plano que orquestra a fila durável do PostgreSQL (FOR UPDATE SKIP LOCKED)
/// com um buffer em memória desacoplado via System.Threading.Channels.Channel.
/// </summary>
public sealed class JobQueueWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly JobQueueOptions _options;
    private readonly ILogger<JobQueueWorker> _logger;
    private readonly Channel<Job> _channel;

    public JobQueueWorker(
        IServiceScopeFactory scopeFactory,
        IOptions<JobQueueOptions> options,
        ILogger<JobQueueWorker> logger)
    {
        _scopeFactory = scopeFactory ?? throw new ArgumentNullException(nameof(scopeFactory));
        _options = options?.Value ?? new JobQueueOptions();
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));

        var channelOptions = new BoundedChannelOptions(Math.Max(1, _options.ChannelCapacity))
        {
            FullMode = BoundedChannelFullMode.Wait,
            SingleWriter = true,
            SingleReader = false
        };

        _channel = Channel.CreateBounded<Job>(channelOptions);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "JobQueueWorker iniciado. Concurrency={Concurrency}, Capacity={Capacity}, BatchSize={BatchSize}, PrefetchThreshold={Prefetch}",
            _options.Concurrency, _options.ChannelCapacity, _options.BatchSize, _options.PrefetchThreshold);

        var consumerCount = Math.Max(1, _options.Concurrency);
        var consumerTasks = new Task[consumerCount];

        for (var i = 0; i < consumerCount; i++)
        {
            var consumerId = i + 1;
            consumerTasks[i] = Task.Run(() => ConsumerLoopAsync(consumerId, stoppingToken), stoppingToken);
        }

        try
        {
            await ProducerLoopAsync(stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            _logger.LogInformation("JobQueueWorker producer cancelado por encerramento do serviço.");
        }
        catch (Exception ex)
        {
            _logger.LogCritical(ex, "Falha crítica no loop do produtor do JobQueueWorker.");
        }
        finally
        {
            _channel.Writer.TryComplete();
            _logger.LogInformation("Canal de jobs finalizado. Aguardando consumidores concluírem itens em processamento...");

            try
            {
                await Task.WhenAll(consumerTasks);
            }
            catch (OperationCanceledException)
            {
                // Esperado no shutdown gracioso
            }

            _logger.LogInformation("JobQueueWorker finalizado com sucesso.");
        }
    }

    private async Task ProducerLoopAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var supportedJobTypes = GetSupportedJobTypes();
                if (supportedJobTypes.Count == 0)
                {
                    await Task.Delay(_options.PollIntervalMs, stoppingToken);
                    continue;
                }

                var totalClaimedInCycle = 0;

                foreach (var jobType in supportedJobTypes)
                {
                    if (stoppingToken.IsCancellationRequested)
                        break;

                    // Se o canal já tem itens suficientes acima do prefetch, aguarda vazão
                    if (_channel.Reader.Count >= _options.PrefetchThreshold)
                    {
                        await Task.Delay(100, stoppingToken);
                        continue;
                    }

                    using var scope = _scopeFactory.CreateScope();
                    var jobRepo = scope.ServiceProvider.GetRequiredService<IJobRepository>();

                    var lockDuration = TimeSpan.FromSeconds(Math.Max(1, _options.LockDurationSeconds));
                    var claimedJobs = await jobRepo.ClaimBatchAsync(jobType, _options.BatchSize, lockDuration, stoppingToken);

                    if (claimedJobs.Count > 0)
                    {
                        totalClaimedInCycle += claimedJobs.Count;

                        foreach (var job in claimedJobs)
                        {
                            await _channel.Writer.WriteAsync(job, stoppingToken);
                        }
                    }
                }

                // Se nenhum job foi encontrado em nenhum tipo de handler, descansa pelo PollIntervalMs
                if (totalClaimedInCycle == 0)
                {
                    await Task.Delay(_options.PollIntervalMs, stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao buscar lote de jobs no banco de dados.");
                await Task.Delay(_options.PollIntervalMs, stoppingToken);
            }
        }
    }

    private async Task ConsumerLoopAsync(int consumerId, CancellationToken stoppingToken)
    {
        _logger.LogDebug("Consumidor {ConsumerId} do JobQueueWorker iniciado.", consumerId);

        try
        {
            while (await _channel.Reader.WaitToReadAsync(stoppingToken))
            {
                while (_channel.Reader.TryRead(out var job))
                {
                    await ProcessJobAsync(consumerId, job, stoppingToken);
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Encerramento normal
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro inesperado no loop do consumidor {ConsumerId}.", consumerId);
        }
        finally
        {
            _logger.LogDebug("Consumidor {ConsumerId} encerrado.", consumerId);
        }
    }

    private async Task ProcessJobAsync(int consumerId, Job job, CancellationToken stoppingToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var jobRepo = scope.ServiceProvider.GetRequiredService<IJobRepository>();
        var handlers = scope.ServiceProvider.GetServices<IJobHandler>();

        var handler = handlers.FirstOrDefault(h => string.Equals(h.JobType, job.Type, StringComparison.OrdinalIgnoreCase));
        if (handler == null)
        {
            _logger.LogError("Nenhum IJobHandler registrado para o JobType '{JobType}'. Marcando job {JobId} como failed.", job.Type, job.Id);
            await jobRepo.FailAsync(job.Id, CancellationToken.None);
            return;
        }

        try
        {
            _logger.LogInformation("Consumidor {ConsumerId} iniciando processamento do job {JobId} (tipo='{JobType}', tentativa={Attempt}).",
                consumerId, job.Id, job.Type, job.Attempts);

            await handler.HandleAsync(job, stoppingToken);
            await jobRepo.AckAsync(job.Id, CancellationToken.None);

            _logger.LogInformation("Job {JobId} concluído com sucesso.", job.Id);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            _logger.LogWarning("Processamento do job {JobId} abortado por cancelamento de shutdown.", job.Id);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Falha ao processar job {JobId} (tipo='{JobType}', tentativa={Attempt}).", job.Id, job.Type, job.Attempts);

            if (job.Attempts >= _options.MaxRetries)
            {
                _logger.LogError("Job {JobId} atingiu limite máximo de {MaxRetries} tentativas. Marcando como failed.", job.Id, _options.MaxRetries);
                await jobRepo.FailAsync(job.Id, CancellationToken.None);
            }
            else
            {
                var delaySeconds = Math.Min(3600, (int)Math.Pow(2, Math.Min(job.Attempts, 10)) * 5);
                var retryDelay = TimeSpan.FromSeconds(delaySeconds);
                _logger.LogInformation("Job {JobId} reagendado com Nack para daqui a {DelaySeconds}s.", job.Id, delaySeconds);
                await jobRepo.NackAsync(job.Id, retryDelay, CancellationToken.None);
            }
        }
    }

    private IReadOnlyList<string> GetSupportedJobTypes()
    {
        using var scope = _scopeFactory.CreateScope();
        var handlers = scope.ServiceProvider.GetServices<IJobHandler>();
        return handlers
            .Select(h => h.JobType)
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }
}
