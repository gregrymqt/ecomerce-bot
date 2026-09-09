using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using EcommerceBot.Application.DTOs.Admin;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Api.Controllers;

[ApiController]
[Route("api/v1/admin")]
public class AdminGrowthController : BaseApiController
{
    private readonly ISaasGrowthService _growthService;
    private readonly ILogger<AdminGrowthController> _logger;

    public AdminGrowthController(ISaasGrowthService growthService, ILogger<AdminGrowthController> logger)
    {
        _growthService = growthService;
        _logger = logger;
    }

    /// <summary>
    /// Registra uma visita ou pageview anônimo na Landing Page / Auth com parâmetros de UTM e Ads.
    /// Rota pública para captura de primeiro toque.
    /// </summary>
    [HttpPost("traffic/visit")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RecordSaasVisit([FromBody] RecordSaasVisitRequestDto request, CancellationToken cancellationToken = default)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = Request.Headers.UserAgent.ToString();

        var visitId = await _growthService.RecordSaasVisitAsync(request, ip, userAgent, cancellationToken);
        return Ok(new { success = true, visit_id = visitId });
    }

    /// <summary>
    /// Retorna o Funil de Aquisição de Clientes do SaaS (Visitas -> Cadastros -> Pagantes).
    /// </summary>
    [HttpGet("analytics/acquisition")]
    [Authorize(Roles = "ADMIN")]
    [ProducesResponseType(typeof(AcquisitionFunnelResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAcquisitionFunnel([FromQuery] int days = 30, CancellationToken cancellationToken = default)
    {
        var result = await _growthService.GetAcquisitionFunnelAsync(days, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Retorna a análise de Unit Economics por Canal/Campanha (Receita Mercado Pago, Custos de IA, CAC, ROAS, Margem Real).
    /// </summary>
    [HttpGet("analytics/unit-economics")]
    [Authorize(Roles = "ADMIN")]
    [ProducesResponseType(typeof(UnitEconomicsResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUnitEconomics([FromQuery] int days = 30, CancellationToken cancellationToken = default)
    {
        var result = await _growthService.GetUnitEconomicsAsync(days, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Registra um lançamento de investimento em tráfego pago (Meta Ads, Google Ads).
    /// </summary>
    [HttpPost("analytics/ad-spend")]
    [Authorize(Roles = "ADMIN")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateAdSpend([FromBody] CreateAdSpendRequestDto request, CancellationToken cancellationToken = default)
    {
        try
        {
            var id = await _growthService.CreateAdSpendAsync(request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, new { success = true, id });
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Dados inválidos ao registrar investimento em tráfego");
            return BadRequestProblem(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro inesperado ao registrar investimento em tráfego");
            return ProblemResponse(StatusCodes.Status500InternalServerError, "Erro ao registrar investimento em tráfego", ex.Message);
        }
    }

    /// <summary>
    /// Lista os investimentos em tráfego cadastrados no período.
    /// </summary>
    [HttpGet("analytics/ad-spend")]
    [Authorize(Roles = "ADMIN")]
    [ProducesResponseType(typeof(IEnumerable<SaasAdSpend>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAdSpends([FromQuery] int days = 30, CancellationToken cancellationToken = default)
    {
        var list = await _growthService.GetAdSpendsAsync(days, cancellationToken);
        return Ok(list);
    }
}
