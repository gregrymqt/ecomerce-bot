using System;
using System.Threading.Tasks;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/tenant")]
public class TenantController : BaseApiController
{
    private readonly ITenantContext _tenantContext;
    private readonly ITenantService _tenantService;

    public TenantController(ITenantContext tenantContext, ITenantService tenantService)
    {
        _tenantContext = tenantContext;
        _tenantService = tenantService;
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentTenantInfo()
    {
        var tenantId = _tenantContext.TenantId != Guid.Empty ? _tenantContext.TenantId : CurrentTenantId;
        if (tenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header is required.");

        var profile = await _tenantService.GetTenantProfileAsync(tenantId);
        if (profile == null)
            return NotFound("Tenant não encontrado.");

        return Ok(profile);
    }
}
