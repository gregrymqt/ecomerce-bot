using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Nuvemshop;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers;

[ApiController]
[Route("api/v1/nuvemshop")]
public class NuvemshopIntegrationController : ControllerBase
{
    private readonly INuvemshopIntegrationService _nuvemshopService;

    public NuvemshopIntegrationController(INuvemshopIntegrationService nuvemshopService)
    {
        _nuvemshopService = nuvemshopService;
    }

    [HttpGet("oauth/callback")]
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
    public async Task<IActionResult> ReceiveWebhook(Guid tenantId, [FromBody] object payload)
    {
        if (tenantId == Guid.Empty)
            return BadRequest("Invalid tenantId");

        await _nuvemshopService.ProcessWebhookAsync(tenantId, payload);
        return Ok();
    }

    [HttpPost("sync/bulk")]
    [Authorize]
    public async Task<IActionResult> TriggerBulkSync(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromBody] NuvemshopBulkSyncRequest request)
    {
        try
        {
            var result = await _nuvemshopService.TriggerBulkSyncAsync(tenantId, request);
            return Accepted(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
