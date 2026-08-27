using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using EcommerceBot.Application.DTOs.Admin;
using EcommerceBot.Application.Interfaces;

namespace EcommerceBot.Api.Controllers;

[ApiController]
[Route("api/v1/admin")]
public class AdminGrowthController : BaseApiController
{
    private readonly ISaasGrowthService _growthService;

    public AdminGrowthController(ISaasGrowthService growthService)
    {
        _growthService = growthService;
    }

    /// <summary>
    /// Registra uma visita ou pageview anônimo na Landing Page / Auth com parâmetros de UTM e Ads.
    /// Rota pública para captura de primeiro toque.
    /// </summary>
    [HttpPost("traffic/visit")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> RecordSaasVisit([FromBody] RecordSaasVisitRequestDto request)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = Request.Headers.UserAgent.ToString();

        var visitId = await _growthService.RecordSaasVisitAsync(request, ip, userAgent);
        return Ok(new { success = true, visit_id = visitId });
    }

    /// <summary>
    /// Retorna o Funil de Aquisição de Clientes do SaaS (Visitas -> Cadastros -> Pagantes).
    /// </summary>
    [HttpGet("analytics/acquisition")]
    [Authorize(Roles = "ADMIN")]
    [ProducesResponseType(typeof(AcquisitionFunnelResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAcquisitionFunnel([FromQuery] int days = 30)
    {
        var result = await _growthService.GetAcquisitionFunnelAsync(days);
        return Ok(result);
    }

    /// <summary>
    /// Retorna a análise de Unit Economics por Canal/Campanha (Receita Mercado Pago, Custos de IA, CAC, ROAS, Margem Real).
    /// </summary>
    [HttpGet("analytics/unit-economics")]
    [Authorize(Roles = "ADMIN")]
    [ProducesResponseType(typeof(UnitEconomicsResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUnitEconomics([FromQuery] int days = 30)
    {
        var result = await _growthService.GetUnitEconomicsAsync(days);
        return Ok(result);
    }

    /// <summary>
    /// Registra um lançamento de investimento em tráfego pago (Meta Ads, Google Ads).
    /// </summary>
    [HttpPost("analytics/ad-spend")]
    [Authorize(Roles = "ADMIN")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateAdSpend([FromBody] CreateAdSpendRequestDto request)
    {
        var id = await _growthService.CreateAdSpendAsync(request);
        return StatusCode(StatusCodes.Status201Created, new { success = true, id });
    }

    /// <summary>
    /// Lista os investimentos em tráfego cadastrados no período.
    /// </summary>
    [HttpGet("analytics/ad-spend")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> GetAdSpends([FromQuery] int days = 30)
    {
        var list = await _growthService.GetAdSpendsAsync(days);
        return Ok(list);
    }
}
