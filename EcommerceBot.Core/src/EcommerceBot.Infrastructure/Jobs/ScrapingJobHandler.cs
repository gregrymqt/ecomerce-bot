namespace EcommerceBot.Infrastructure.Jobs;

using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Messaging;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Logging;

/// <summary>
/// Handler de processamento para jobs do tipo "scraping".
/// Executa a extração perimetral segura do produto e, em caso de sucesso,
/// comita o Ack do job atual e o Enqueue do próximo estágio ("seo_enrichment")
/// em uma única transação atômica no banco de dados.
/// </summary>
public sealed class ScrapingJobHandler : IJobHandler
{
    public string JobType => "scraping";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly IProductScraper _scraper;
    private readonly IJobRepository _jobRepository;
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly ILogger<ScrapingJobHandler> _logger;

    public ScrapingJobHandler(
        IProductScraper scraper,
        IJobRepository jobRepository,
        IDbConnectionFactory connectionFactory,
        ILogger<ScrapingJobHandler> logger)
    {
        _scraper = scraper ?? throw new ArgumentNullException(nameof(scraper));
        _jobRepository = jobRepository ?? throw new ArgumentNullException(nameof(jobRepository));
        _connectionFactory = connectionFactory ?? throw new ArgumentNullException(nameof(connectionFactory));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task HandleAsync(Job job, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(job);

        _logger.LogInformation("Iniciando execução do ScrapingJobHandler para Job {JobId}, Tenant {TenantId}",
            job.Id, job.TenantId);

        ScrapingRequestMessage? request;
        try
        {
            request = JsonSerializer.Deserialize<ScrapingRequestMessage>(job.Payload, JsonOptions);
        }
        catch (JsonException jsonEx)
        {
            _logger.LogError(jsonEx, "Payload inválido para ScrapingRequestMessage no Job {JobId}: {Payload}",
                job.Id, job.Payload);
            throw new InvalidOperationException($"Payload JSON inválido para ScrapingRequestMessage: {jsonEx.Message}", jsonEx);
        }

        if (request == null || string.IsNullOrWhiteSpace(request.Url))
        {
            throw new InvalidOperationException($"Job {job.Id} possui requisição de scraping vazia ou sem URL.");
        }

        if (request.TenantId == Guid.Empty)
        {
            request = request with { TenantId = job.TenantId };
        }

        // 1. Executa a extração perimetral segura do produto
        var scraped = await _scraper.ScrapeAsync(request, ct);

        if (!scraped.Success)
        {
            var error = !string.IsNullOrWhiteSpace(scraped.ErrorMessage)
                ? scraped.ErrorMessage
                : "Scraping falhou sem mensagem detalhada.";

            _logger.LogWarning("Scraping falhou para Job {JobId}, URL {Url}: {Error}", job.Id, request.Url, error);
            throw new InvalidOperationException($"Scraping failed: {error}");
        }

        // 2. Transação atômica: Ack do job de scraping + Enqueue do job seo_enrichment
        using var conn = await _connectionFactory.CreateSystemConnectionAsync(ct);
        using var tx = conn.BeginTransaction();

        try
        {
            var seoPayload = JsonSerializer.Serialize(scraped, JsonOptions);
            var nextJobId = Guid.NewGuid();

            var seoJob = new Job
            {
                Id = nextJobId,
                TenantId = job.TenantId,
                Type = "seo_enrichment",
                Payload = seoPayload,
                Status = "pending",
                Attempts = 0,
                NextRunAt = DateTimeOffset.UtcNow
            };

            await _jobRepository.AckAsync(job.Id, conn, tx, ct);
            await _jobRepository.EnqueueAsync(seoJob, conn, tx, ct);

            tx.Commit();

            _logger.LogInformation(
                "Job de scraping {JobId} concluído com êxito. Estágio 'seo_enrichment' enfileirado com sucesso (JobId={NextJobId})",
                job.Id, nextJobId);
        }
        catch (Exception ex)
        {
            try
            {
                tx.Rollback();
            }
            catch (Exception rbEx)
            {
                _logger.LogWarning(rbEx, "Falha ao realizar rollback na transação do Job {JobId}", job.Id);
            }

            _logger.LogError(ex, "Erro ao comitar transação atômica de Ack/Enqueue para Job {JobId}", job.Id);
            throw;
        }
    }
}
