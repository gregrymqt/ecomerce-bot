using System;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Settings;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/settings")]
public class SettingsController : BaseApiController
{
    private readonly ISettingsService _settingsService;
    private readonly ILogger<SettingsController> _logger;

    public SettingsController(ISettingsService settingsService, ILogger<SettingsController> logger)
    {
        _settingsService = settingsService;
        _logger = logger;
    }

    [HttpGet]
    [ProducesResponseType(typeof(TenantSettingsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSettings(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
        {
            return BadRequestProblem("X-Tenant-ID header is required.");
        }

        var settings = await _settingsService.GetSettingsAsync(activeTenantId);
        if (settings == null)
        {
            return NotFoundProblem($"Configurações para o tenant '{activeTenantId}' não foram encontradas.");
        }

        return Ok(settings);
    }

    [HttpPut]
    [ProducesResponseType(typeof(TenantSettingsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateSettings(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromBody] TenantSettingsUpdate payload,
        CancellationToken cancellationToken = default)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
        {
            return BadRequestProblem("X-Tenant-ID header is required.");
        }

        try
        {
            var updatedSettings = await _settingsService.UpdateSettingsAsync(activeTenantId, payload);
            return Ok(updatedSettings);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Dados inválidos para atualização de configurações no tenant {TenantId}", activeTenantId);
            return BadRequestProblem(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro inesperado ao atualizar configurações para tenant {TenantId}", activeTenantId);
            return ProblemResponse(StatusCodes.Status500InternalServerError, "Erro ao atualizar configurações", ex.Message);
        }
    }
}
