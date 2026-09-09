using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using EcommerceBot.Application.DTOs.Analytics;
using EcommerceBot.Application.Interfaces;

namespace EcommerceBot.Api.Controllers;

[ApiController]
[Route("api/v1/analytics/traffic")]
public class TrafficAnalyticsController : BaseApiController
{
    private readonly ITrafficAnalyticsService _trafficService;
    private readonly ILogger<TrafficAnalyticsController> _logger;

    public TrafficAnalyticsController(
        ITrafficAnalyticsService trafficService,
        ILogger<TrafficAnalyticsController> logger)
    {
        _trafficService = trafficService;
        _logger = logger;
    }

    /// <summary>
    /// Registra uma visita ou pageview vindo do script tracker.js instalado na loja do cliente.
    /// Rota pública e leve.
    /// </summary>
    [HttpPost("visit")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RecordTenantVisit([FromBody] RecordTenantVisitRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request.TenantId == Guid.Empty)
        {
            return BadRequestProblem("TenantId é obrigatório para registrar a visita.");
        }

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = Request.Headers.UserAgent.ToString();

        var id = await _trafficService.RecordTenantVisitAsync(request, ip, userAgent, cancellationToken);
        return Ok(new { success = true, id });
    }

    /// <summary>
    /// Retorna o resumo de métricas de tráfego, vendas atribuídas a anúncios e criativos do lojista autenticado.
    /// </summary>
    [HttpGet]
    [Authorize]
    [ProducesResponseType(typeof(TenantTrafficOverviewDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetTrafficOverview(
        [FromQuery] int days = 30,
        [FromQuery] string? source = null,
        CancellationToken cancellationToken = default)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty)
        {
            return BadRequestProblem("X-Tenant-ID header é obrigatório.");
        }

        var result = await _trafficService.GetTenantTrafficOverviewAsync(tenantId, days, source, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Faz uma verificação ativa na loja virtual do lojista para validar se o script tracker.js está instalado.
    /// </summary>
    [HttpPost("verify-tag")]
    [Authorize]
    [ProducesResponseType(typeof(VerifyTagResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> VerifyTag([FromBody] VerifyTagRequestDto request, CancellationToken cancellationToken = default)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty)
        {
            return BadRequestProblem("X-Tenant-ID header é obrigatório.");
        }

        if (string.IsNullOrWhiteSpace(request.StoreUrl))
        {
            return BadRequestProblem("StoreUrl é obrigatório.");
        }

        var result = await _trafficService.VerifyStoreTagAsync(tenantId, request.StoreUrl, cancellationToken);
        return Ok(result);
    }
}
