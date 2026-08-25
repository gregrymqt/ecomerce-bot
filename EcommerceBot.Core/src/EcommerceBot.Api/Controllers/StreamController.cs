using System;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using StackExchange.Redis;
using EcommerceBot.Application.Interfaces;

namespace EcommerceBot.Api.Controllers;

[ApiController]
[Route("api/v1/demo/stream")]
public class StreamController : ControllerBase
{
    private readonly ITenantContext _tenantContext;
    private readonly IConnectionMultiplexer _redis;

    public StreamController(ITenantContext tenantContext, IConnectionMultiplexer redis)
    {
        _tenantContext = tenantContext;
        _redis = redis;
    }

    [HttpGet]
    public async Task GetStream(CancellationToken cancellationToken)
    {
        var tenantId = _tenantContext.TenantId;

        Response.Headers.Append("Content-Type", "text/event-stream");
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("Connection", "keep-alive");

        var subscriber = _redis.GetSubscriber();
        // O canal é isolado por TenantId para que usuários de uma empresa não vejam eventos de outra
        var channel = new RedisChannel($"events:tenant:{tenantId}", RedisChannel.PatternMode.Literal);

        // Envia um ping inicial
        await Response.WriteAsync($"data: {{\"type\":\"connected\", \"tenantId\":\"{tenantId}\"}}\n\n", cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);

        // Criamos um Channel do C# para transferir os dados da thread do Redis para a thread da WebAPI
        var channelBuffer = System.Threading.Channels.Channel.CreateUnbounded<string>();

        await subscriber.SubscribeAsync(channel, async (ch, message) =>
        {
            await channelBuffer.Writer.WriteAsync(message.ToString());
        });

        try
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                // Espera por mensagens do Redis ou pelo timeout de heartbeat (30s)
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                cts.CancelAfter(TimeSpan.FromSeconds(30));

                try
                {
                    var msg = await channelBuffer.Reader.ReadAsync(cts.Token);
                    
                    // Formato SSE: "data: payload\n\n"
                    await Response.WriteAsync($"data: {msg}\n\n", cancellationToken);
                    await Response.Body.FlushAsync(cancellationToken);
                }
                catch (OperationCanceledException)
                {
                    // Heartbeat para manter a conexão ativa
                    if (!cancellationToken.IsCancellationRequested)
                    {
                        await Response.WriteAsync($": heartbeat\n\n", cancellationToken);
                        await Response.Body.FlushAsync(cancellationToken);
                    }
                }
            }
        }
        finally
        {
            await subscriber.UnsubscribeAsync(channel);
            channelBuffer.Writer.TryComplete();
        }
    }
}
