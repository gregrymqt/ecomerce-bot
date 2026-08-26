using System;
using System.IO;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.System;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;
using StackExchange.Redis;

namespace EcommerceBot.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class SystemController : ControllerBase
{
    private readonly ISystemService _systemService;
    private readonly IConnectionMultiplexer _redis;

    public SystemController(ISystemService systemService, IConnectionMultiplexer redis)
    {
        _systemService = systemService;
        _redis = redis;
    }

    [HttpGet("telemetry")]
    public async Task<IActionResult> GetTelemetry(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromQuery] string timeframe = "24h")
    {
        var metrics = await _systemService.GetTelemetryMetricsAsync(tenantId, timeframe);
        return Ok(metrics);
    }

    [HttpGet("activities")]
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
    public async Task ExportData(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromQuery] string platform = "shopify")
    {
        Response.Headers.Add("Content-Disposition", $"attachment; filename=export_{platform}_{tenantId}.csv");
        Response.Headers.Add("Access-Control-Expose-Headers", "Content-Disposition");
        Response.ContentType = "text/csv";

        using var streamWriter = new StreamWriter(Response.Body);
        await _systemService.ExportDataToStreamAsync(tenantId, platform, streamWriter);
    }

    [HttpGet("demo/stream")]
    public async Task DemoStream()
    {
        Response.Headers.Add("Content-Type", "text/event-stream");
        var subscriber = _redis.GetSubscriber();
        var channel = new RedisChannel("demo_progress", RedisChannel.PatternMode.Literal);

        // Aguarda os eventos e faz flush pro client
        var queue = await subscriber.SubscribeAsync(channel);
        try
        {
            queue.OnMessage(async message => 
            {
                var data = $"data: {message.Message}\n\n";
                var bytes = System.Text.Encoding.UTF8.GetBytes(data);
                await Response.Body.WriteAsync(bytes, 0, bytes.Length);
                await Response.Body.FlushAsync();
            });

            // Mantém a conexão viva até o cliente desconectar
            while (!HttpContext.RequestAborted.IsCancellationRequested)
            {
                await Task.Delay(1000, HttpContext.RequestAborted);
            }
        }
        catch (TaskCanceledException)
        {
            // Cliente desconectou
        }
        finally
        {
            await subscriber.UnsubscribeAsync(channel);
        }
    }
}
