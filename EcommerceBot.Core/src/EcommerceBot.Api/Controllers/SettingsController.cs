using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Settings;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/settings")]
public class SettingsController : BaseApiController
{
    private readonly ISettingsService _settingsService;

    public SettingsController(ISettingsService settingsService)
    {
        _settingsService = settingsService;
    }

    [HttpGet]
    public async Task<IActionResult> GetSettings([FromHeader(Name = "X-Tenant-ID")] Guid tenantId)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header is required.");

        var settings = await _settingsService.GetSettingsAsync(activeTenantId);
        return Ok(settings);
    }

    [HttpPut]
    public async Task<IActionResult> UpdateSettings(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromBody] TenantSettingsUpdate payload)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header is required.");

        var updatedSettings = await _settingsService.UpdateSettingsAsync(activeTenantId, payload);
        return Ok(updatedSettings);
    }
}
