using System;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/demo/stream")]
public class StreamController : BaseApiController
{
    private readonly ITenantContext _tenantContext;
    private readonly IRedisService _redisService;
    private readonly ILogger<StreamController> _logger;

    public StreamController(
        ITenantContext tenantContext,
        IRedisService redisService,
        ILogger<StreamController> logger)
    {
        _tenantContext = tenantContext;
        _redisService = redisService;
        _logger = logger;
    }

    [HttpGet]
    [Produces("text/event-stream")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task GetStream(CancellationToken cancellationToken)
    {
        var tenantId = _tenantContext.TenantId != Guid.Empty ? _tenantContext.TenantId : CurrentTenantId;
        if (tenantId == Guid.Empty)
        {
            Response.StatusCode = StatusCodes.Status400BadRequest;
            Response.ContentType = "application/problem+json";
            var problem = new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Tenant Inválido",
                Detail = "X-Tenant-ID header é obrigatório para abrir stream SSE."
            };
            await Response.WriteAsJsonAsync(problem, cancellationToken);
            return;
        }

        Response.Headers.Append("Content-Type", "text/event-stream");
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("Connection", "keep-alive");

        var channel = $"events:tenant:{tenantId}";

        // Envia um ping inicial
        await Response.WriteAsync($"data: {{\"type\":\"connected\", \"tenantId\":\"{tenantId}\"}}\n\n", cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);

        // Channel do C# para transferir mensagens do Redis para a thread da WebAPI
        var channelBuffer = Channel.CreateUnbounded<string>();

        await _redisService.SubscribeAsync(channel, async message =>
        {
            await channelBuffer.Writer.WriteAsync(message, cancellationToken);
        });

        try
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                cts.CancelAfter(TimeSpan.FromSeconds(30));

                try
                {
                    var msg = await channelBuffer.Reader.ReadAsync(cts.Token);
                    await Response.WriteAsync($"data: {msg}\n\n", cancellationToken);
                    await Response.Body.FlushAsync(cancellationToken);
                }
                catch (OperationCanceledException)
                {
                    if (!cancellationToken.IsCancellationRequested)
                    {
                        await Response.WriteAsync(": heartbeat\n\n", cancellationToken);
                        await Response.Body.FlushAsync(cancellationToken);
                    }
                }
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Conexão SSE encerrada pelo cliente para tenant {TenantId}", tenantId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro no streaming SSE para tenant {TenantId}", tenantId);
        }
        finally
        {
            await _redisService.UnsubscribeAsync(channel);
            channelBuffer.Writer.TryComplete();
        }
    }
}
