using System;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers;

[ApiController]
[Route("api/v1/demo/stream")]
public class StreamController : ControllerBase
{
    private readonly ITenantContext _tenantContext;
    private readonly IRedisService _redisService;

    public StreamController(ITenantContext tenantContext, IRedisService redisService)
    {
        _tenantContext = tenantContext;
        _redisService = redisService;
    }

    [HttpGet]
    public async Task GetStream(CancellationToken cancellationToken)
    {
        var tenantId = _tenantContext.TenantId;

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
        finally
        {
            await _redisService.UnsubscribeAsync(channel);
            channelBuffer.Writer.TryComplete();
        }
    }
}
