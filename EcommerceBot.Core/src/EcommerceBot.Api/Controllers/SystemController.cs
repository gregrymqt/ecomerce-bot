using System;
using System.IO;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using EcommerceBot.Api.Filters;
using EcommerceBot.Application.DTOs.System;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/[controller]")]
public class SystemController : BaseApiController
{
    private readonly ISystemService _systemService;
    private readonly IRedisService _redisService;

    public SystemController(ISystemService systemService, IRedisService redisService)
    {
        _systemService = systemService;
        _redisService = redisService;
    }

    [HttpGet("telemetry")]
    public async Task<IActionResult> GetTelemetry(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromQuery] string timeframe = "24h",
        CancellationToken cancellationToken = default)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        var metrics = await _systemService.GetTelemetryMetricsAsync(activeTenantId, timeframe, cancellationToken);
        return Ok(metrics);
    }

    [HttpGet("activities")]
    public async Task<IActionResult> GetActivities(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromQuery] int limit = 20,
        [FromQuery] int page = 1,
        CancellationToken cancellationToken = default)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        var activities = await _systemService.GetRecentActivitiesAsync(activeTenantId, limit, page, cancellationToken);
        return Ok(activities);
    }

    [HttpGet("health")]
    [AllowAnonymous]
    public async Task<IActionResult> HealthCheck(CancellationToken cancellationToken = default)
    {
        var health = await _systemService.CheckSystemHealthAsync(cancellationToken);
        return StatusCode(health.Status == "OK" ? StatusCodes.Status200OK : StatusCodes.Status503ServiceUnavailable, health);
    }

    [HttpPost("demo")]
    [AllowAnonymous]
    [RateLimit(MaxRequests = 10, WindowSeconds = 60, BlockDurationSeconds = 300)]
    public async Task<IActionResult> RequestDemo([FromBody] DemoRequest payload, CancellationToken cancellationToken = default)
    {
        if (payload.Urls.Count > 3)
            return BadRequestProblem("O limite máximo permitido é de 3 URLs para a demonstração.");

        await _systemService.ProcessDemoRequestAsync(payload.Urls, cancellationToken);
        return Ok(new { status = "enviado_para_fila" });
    }

    [HttpGet("export")]
    [CsvSizeLimit(MaxMegabytes = 10)]
    public async Task ExportData(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromQuery] string platform = "shopify",
        CancellationToken cancellationToken = default)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;

        Response.Headers.Append("Content-Disposition", $"attachment; filename=export_{platform}_{activeTenantId}.csv");
        Response.Headers.Append("Access-Control-Expose-Headers", "Content-Disposition");
        Response.ContentType = "text/csv";

        using var streamWriter = new StreamWriter(Response.Body);
        await _systemService.ExportDataToStreamAsync(activeTenantId, platform, streamWriter, cancellationToken);
    }

    [HttpGet("demo/stream")]
    [AllowAnonymous]
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
