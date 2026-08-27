using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using EcommerceBot.Application.DTOs.Analytics;
using EcommerceBot.Application.Interfaces;

namespace EcommerceBot.Api.Controllers;

[ApiController]
[Route("api/v1/analytics/traffic")]
public class TrafficAnalyticsController : BaseApiController
{
    private readonly ITrafficAnalyticsService _trafficService;

    public TrafficAnalyticsController(ITrafficAnalyticsService trafficService)
    {
        _trafficService = trafficService;
    }

    /// <summary>
    /// Registra uma visita ou pageview vindo do script tracker.js instalado na loja do cliente.
    /// Rota pública e leve.
    /// </summary>
    [HttpPost("visit")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> RecordTenantVisit([FromBody] RecordTenantVisitRequestDto request)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = Request.Headers.UserAgent.ToString();

        var id = await _trafficService.RecordTenantVisitAsync(request, ip, userAgent);
        return Ok(new { success = true, id });
    }

    /// <summary>
    /// Retorna o resumo de métricas de tráfego, vendas atribuídas a anúncios e criativos do lojista autenticado.
    /// </summary>
    [HttpGet]
    [Authorize]
    [ProducesResponseType(typeof(TenantTrafficOverviewDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTrafficOverview([FromQuery] int days = 30, [FromQuery] string? source = null)
    {
        var result = await _trafficService.GetTenantTrafficOverviewAsync(CurrentTenantId, days, source);
        return Ok(result);
    }

    /// <summary>
    /// Faz uma verificação ativa na loja virtual do lojista para validar se o script tracker.js está instalado.
    /// </summary>
    [HttpPost("verify-tag")]
    [Authorize]
    [ProducesResponseType(typeof(VerifyTagResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> VerifyTag([FromBody] VerifyTagRequestDto request)
    {
        var result = await _trafficService.VerifyStoreTagAsync(CurrentTenantId, request.StoreUrl);
        return Ok(result);
    }
}
