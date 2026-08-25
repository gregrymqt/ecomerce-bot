using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Api.Controllers;

[ApiController]
[Route("api/v1/tenant")]
public class TenantController : ControllerBase
{
    private readonly ITenantContext _tenantContext;
    private readonly ITenantRepository _tenantRepository;

    public TenantController(ITenantContext tenantContext, ITenantRepository tenantRepository)
    {
        _tenantContext = tenantContext;
        _tenantRepository = tenantRepository;
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentTenantInfo()
    {
        // Pega o GUID injetado pelo Middleware
        var tenantId = _tenantContext.TenantId;
        
        var tenant = await _tenantRepository.GetByIdAsync(tenantId);
        if (tenant == null)
            return NotFound("Tenant não encontrado.");

        return Ok(new 
        {
            tenant.Id,
            tenant.Name,
            tenant.Slug,
            tenant.PlanTier,
            tenant.CreditsBalance,
            tenant.CreatedAt
        });
    }
}
