using System;
using System.Threading;
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
    public async Task<IActionResult> GetCurrentTenantInfo(CancellationToken cancellationToken = default)
    {
        var tenantId = _tenantContext.TenantId != Guid.Empty ? _tenantContext.TenantId : CurrentTenantId;
        if (tenantId == Guid.Empty)
            return BadRequestProblem("O header X-Tenant-ID é obrigatório.");

        var profile = await _tenantService.GetTenantProfileAsync(tenantId, cancellationToken);
        if (profile == null)
            return NotFoundProblem("Tenant não encontrado.");

        return Ok(profile);
    }

    /// <summary>
    /// Endpoint de inspeção do TenantId autenticado para diagnóstico e testes de conectividade.
    /// </summary>
    [HttpGet("/api/v1/tenant-info")]
    public IActionResult GetTenantInfo()
    {
        var tenantId = _tenantContext.TenantId != Guid.Empty ? _tenantContext.TenantId : CurrentTenantId;
        return Ok(new { TenantId = tenantId, Message = "Acesso autorizado!" });
    }
}
