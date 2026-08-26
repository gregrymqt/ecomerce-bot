using System.Threading.Tasks;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers;

[ApiController]
[Route("api/v1/tenant")]
[Authorize]
public class TenantController : ControllerBase
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
        var tenantId = _tenantContext.TenantId;
        var profile = await _tenantService.GetTenantProfileAsync(tenantId);
        
        if (profile == null)
            return NotFound("Tenant não encontrado.");

        return Ok(profile);
    }
}
