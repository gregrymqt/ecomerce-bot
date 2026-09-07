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
[Route("api/v1/admin/ai-capacity")]
[Authorize(Roles = "ADMIN")]
public class AdminAiCapacityController : BaseApiController
{
    private readonly IAiCapacityService _aiCapacityService;
    private readonly ILogger<AdminAiCapacityController> _logger;

    public AdminAiCapacityController(
        IAiCapacityService aiCapacityService,
        ILogger<AdminAiCapacityController> logger)
    {
        _aiCapacityService = aiCapacityService;
        _logger = logger;
    }

    /// <summary>
    /// Retorna a visão consolidada de FinOps e previsão de capacidade de tokens (Baixa, Recomendada, Segurança).
    /// </summary>
    [HttpGet("overview")]
    [ProducesResponseType(typeof(AiCapacityOverviewResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOverview([FromQuery] int days = 30, CancellationToken cancellationToken = default)
    {
        var response = await _aiCapacityService.GetCapacityOverviewAsync(days);
        return Ok(response);
    }

    /// <summary>
    /// Registra manualmente uma recarga realizada diretamente no painel da operadora (DeepSeek, Gemini, OpenRouter).
    /// </summary>
    [HttpPost("topup")]
    [ProducesResponseType(typeof(AiProviderCreditDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RegisterTopup([FromBody] AiProviderCreditTopupRequest request, CancellationToken cancellationToken = default)
    {
        if (request.AmountPaid <= 0)
        {
            return BadRequestProblem("O valor da recarga deve ser maior que zero.");
        }

        try
        {
            var topupRequest = request with { Source = "MANUAL_ADMIN" };
            var result = await _aiCapacityService.RegisterTopupAsync(topupRequest);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Dados inválidos ao registrar recarga manual de IA");
            return BadRequestProblem(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro inesperado ao registrar recarga manual de IA");
            return ProblemResponse(StatusCodes.Status500InternalServerError, "Erro na recarga de IA", ex.Message);
        }
    }

    /// <summary>
    /// Dispara o recálculo preditivo assíncrono via RabbitMQ no worker de Machine Learning.
    /// </summary>
    [HttpPost("trigger")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> TriggerRecalculation(CancellationToken cancellationToken = default)
    {
        var queued = await _aiCapacityService.TriggerForecastRecalculationAsync();
        return Ok(new { success = queued, message = "Recálculo de capacidade de IA enfileirado com sucesso." });
    }
}
