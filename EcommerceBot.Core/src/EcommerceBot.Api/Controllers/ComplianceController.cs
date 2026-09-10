using System;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers;

/// <summary>
/// Endpoints para rastreabilidade de segurança, trilha de auditoria e conformidade LGPD/SOC 2.
/// </summary>
[Authorize]
[Route("api/v1/compliance")]
public class ComplianceController : BaseApiController
{
    private readonly IAuditService _auditService;
    private readonly ITenantContext _tenantContext;

    public ComplianceController(IAuditService auditService, ITenantContext tenantContext)
    {
        _auditService = auditService ?? throw new ArgumentNullException(nameof(auditService));
        _tenantContext = tenantContext ?? throw new ArgumentNullException(nameof(tenantContext));
    }

    /// <summary>
    /// Retorna a trilha de auditoria paginada dos eventos registrados para o tenant autenticado.
    /// </summary>
    [HttpGet("audit-logs")]
    public async Task<IActionResult> GetAuditLogs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var tenantId = _tenantContext.HasTenant ? _tenantContext.TenantId : CurrentTenantId;
        if (tenantId == Guid.Empty)
        {
            return BadRequestProblem("Contexto de Tenant não identificado na requisição.");
        }

        var logs = await _auditService.GetAuditTrailAsync(page, pageSize, cancellationToken);
        return Ok(logs);
    }

    /// <summary>
    /// Exercício do Direito ao Esquecimento (LGPD Art. 18):
    /// Anonimiza irreversivelmente os dados de usuários e inativa o lojista no ecossistema.
    /// </summary>
    [HttpPost("forget-me")]
    public async Task<IActionResult> RequestRightToBeForgotten(CancellationToken cancellationToken = default)
    {
        var tenantId = _tenantContext.HasTenant ? _tenantContext.TenantId : CurrentTenantId;
        if (tenantId == Guid.Empty)
        {
            return BadRequestProblem("Contexto de Tenant não identificado na requisição.");
        }

        await _auditService.ExecuteRightToBeForgottenAsync(tenantId, cancellationToken);

        return Ok(new
        {
            status = "SUCCESS",
            message = "Solicitação de Direito ao Esquecimento (LGPD Art. 18) processada com sucesso. Seus dados foram anonimizados."
        });
    }
}
