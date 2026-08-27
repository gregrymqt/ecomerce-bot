using System;
using System.Threading.Tasks;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/integrations")]
public class IntegrationsController : BaseApiController
{
    private readonly IStoreIntegrationService _storeIntegrationService;

    public IntegrationsController(IStoreIntegrationService storeIntegrationService)
    {
        _storeIntegrationService = storeIntegrationService;
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromHeader(Name = "X-Tenant-ID")] Guid tenantId)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header é obrigatório.");

        var summary = await _storeIntegrationService.GetSummaryAsync(activeTenantId);
        return Ok(summary);
    }

    [HttpGet]
    public async Task<IActionResult> ListIntegrations([FromHeader(Name = "X-Tenant-ID")] Guid tenantId)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header é obrigatório.");

        var integrations = await _storeIntegrationService.ListIntegrationsAsync(activeTenantId);
        return Ok(integrations);
    }

    [HttpPost("{id}/health-check")]
    public async Task<IActionResult> TestHealthCheck(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        Guid id)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header é obrigatório.");

        var result = await _storeIntegrationService.TestHealthCheckAsync(activeTenantId, id);
        return Ok(result);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DisconnectStore(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        Guid id)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header é obrigatório.");

        var success = await _storeIntegrationService.DisconnectStoreAsync(activeTenantId, id);
        if (!success)
            return NotFound("Integração não encontrada.");

        return Ok(new { message = "Loja desconectada com sucesso." });
    }
}
