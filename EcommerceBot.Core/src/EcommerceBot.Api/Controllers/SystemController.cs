using System;
using System.IO;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.System;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class SystemController : ControllerBase
{
    private readonly ISystemService _systemService;
    private readonly IRedisService _redisService;

    public SystemController(ISystemService systemService, IRedisService redisService)
    {
        _systemService = systemService;
        _redisService = redisService;
    }

    [HttpGet("telemetry")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> GetTelemetry(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromQuery] string timeframe = "24h")
    {
        var metrics = await _systemService.GetTelemetryMetricsAsync(tenantId, timeframe);
        return Ok(metrics);
    }

    [HttpGet("activities")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> GetActivities(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromQuery] int limit = 20,
        [FromQuery] int page = 1)
    {
        var activities = await _systemService.GetRecentActivitiesAsync(tenantId, limit, page);
        return Ok(activities);
    }

    [HttpGet("health")]
    public async Task<IActionResult> HealthCheck()
    {
        var health = await _systemService.CheckSystemHealthAsync();
        return StatusCode(health.Status == "OK" ? 200 : 503, health);
    }

    [HttpPost("demo")]
    public async Task<IActionResult> RequestDemo([FromBody] DemoRequest payload)
    {
        if (payload.Urls.Count > 3) return BadRequest("Max 3 URLs allowed");
        await _systemService.ProcessDemoRequestAsync(payload.Urls);
        return Ok(new { status = "enviado_para_fila" });
    }

    [HttpGet("export")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task ExportData(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromQuery] string platform = "shopify")
    {
        Response.Headers.Append("Content-Disposition", $"attachment; filename=export_{platform}_{tenantId}.csv");
        Response.Headers.Append("Access-Control-Expose-Headers", "Content-Disposition");
        Response.ContentType = "text/csv";

        using var streamWriter = new StreamWriter(Response.Body);
        await _systemService.ExportDataToStreamAsync(tenantId, platform, streamWriter);
    }

    [HttpGet("demo/stream")]
    public async Task DemoStream(CancellationToken cancellationToken)
    {
        Response.Headers.Append("Content-Type", "text/event-stream");
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("Connection", "keep-alive");

        var channel = "demo_progress";
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
