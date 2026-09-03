using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using EcommerceBot.Application.DTOs.Analytics;
using EcommerceBot.Application.Interfaces;

namespace EcommerceBot.Api.Controllers;

[ApiController]
[Route("api/v1/admin/ai-capacity")]
[Authorize(Roles = "ADMIN")]
public class AdminAiCapacityController : BaseApiController
{
    private readonly IAiCapacityService _aiCapacityService;

    public AdminAiCapacityController(IAiCapacityService aiCapacityService)
    {
        _aiCapacityService = aiCapacityService;
    }

    /// <summary>
    /// Retorna a visão consolidada de FinOps e previsão de capacidade de tokens (Baixa, Recomendada, Segurança).
    /// </summary>
    [HttpGet("overview")]
    [ProducesResponseType(typeof(AiCapacityOverviewResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOverview([FromQuery] int days = 30)
    {
        var response = await _aiCapacityService.GetCapacityOverviewAsync(days);
        return Ok(response);
    }

    /// <summary>
    /// Registra manualmente uma recarga realizada diretamente no painel da operadora (DeepSeek, Gemini, OpenRouter).
    /// </summary>
    [HttpPost("topup")]
    [ProducesResponseType(typeof(AiProviderCreditDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> RegisterTopup([FromBody] AiProviderCreditTopupRequest request)
    {
        if (request.AmountPaid <= 0)
        {
            return BadRequest(new { error = "O valor da recarga deve ser maior que zero." });
        }

        request.Source = "MANUAL_ADMIN";
        var result = await _aiCapacityService.RegisterTopupAsync(request);
        return Ok(result);
    }

    /// <summary>
    /// Dispara o recálculo preditivo assíncrono via RabbitMQ no worker de Machine Learning.
    /// </summary>
    [HttpPost("trigger")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> TriggerRecalculation()
    {
        var queued = await _aiCapacityService.TriggerForecastRecalculationAsync();
        return Ok(new { success = queued, message = "Recálculo de capacidade de IA enfileirado com sucesso." });
    }
}
