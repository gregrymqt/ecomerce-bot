using System;
using System.Threading.Tasks;
using EcommerceBot.Api.Filters;
using EcommerceBot.Application.DTOs.Nuvemshop;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/nuvemshop")]
public class NuvemshopIntegrationController : BaseApiController
{
    private readonly INuvemshopIntegrationService _nuvemshopService;

    public NuvemshopIntegrationController(INuvemshopIntegrationService nuvemshopService)
    {
        _nuvemshopService = nuvemshopService;
    }

    [HttpGet("oauth/callback")]
    [AllowAnonymous]
    public async Task<IActionResult> OAuthCallback([FromQuery] string code, [FromQuery] string state)
    {
        if (!Guid.TryParse(state, out var tenantId))
        {
            return BadRequest("Invalid state parameter");
        }

        await _nuvemshopService.HandleOAuthCallbackAsync(tenantId, code);
        return Ok(new { message = "Nuvemshop connected successfully!" });
    }

    [HttpPost("webhooks/{tenantId}")]
    [AllowAnonymous]
    [RateLimit(MaxRequests = 120, WindowSeconds = 60, BlockDurationSeconds = 300)]
    public async Task<IActionResult> ReceiveWebhook(Guid tenantId, [FromBody] object payload)
    {
        if (tenantId == Guid.Empty)
            return BadRequest("Invalid tenantId");

        await _nuvemshopService.ProcessWebhookAsync(tenantId, payload);
        return Ok();
    }

    [HttpPost("sync/bulk")]
    public async Task<IActionResult> TriggerBulkSync(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromBody] NuvemshopBulkSyncRequest request)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header is required.");

        try
        {
            var result = await _nuvemshopService.TriggerBulkSyncAsync(activeTenantId, request);
            return Accepted(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
