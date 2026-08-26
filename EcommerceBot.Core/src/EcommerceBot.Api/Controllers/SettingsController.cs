using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Settings;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers;

[ApiController]
[Route("api/v1/settings")]
[Authorize] // Pode ajustar se tiver auth middleware customizado
public class SettingsController : ControllerBase
{
    private readonly ISettingsService _settingsService;

    public SettingsController(ISettingsService settingsService)
    {
        _settingsService = settingsService;
    }

    [HttpGet]
    public async Task<IActionResult> GetSettings([FromHeader(Name = "X-Tenant-ID")] Guid tenantId)
    {
        if (tenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header is required.");

        var settings = await _settingsService.GetSettingsAsync(tenantId);
        return Ok(settings);
    }

    [HttpPut]
    public async Task<IActionResult> UpdateSettings(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromBody] TenantSettingsUpdate payload)
    {
        if (tenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header is required.");

        var updatedSettings = await _settingsService.UpdateSettingsAsync(tenantId, payload);
        return Ok(updatedSettings);
    }
}
