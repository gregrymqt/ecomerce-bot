using System;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Billing;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Api.Controllers;

/// <summary>
/// Controlador para gerenciamento do perfil de faturamento, identificação fiscal (CPF/CNPJ) e endereço do Tenant.
/// </summary>
[Route("api/v1/billing/profile")]
public sealed class BillingProfileController : BaseApiController
{
    private readonly ITenantBillingProfileService _billingProfileService;
    private readonly ILogger<BillingProfileController> _logger;

    public BillingProfileController(
        ITenantBillingProfileService billingProfileService,
        ILogger<BillingProfileController> logger)
    {
        _billingProfileService = billingProfileService ?? throw new ArgumentNullException(nameof(billingProfileService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <summary>
    /// Obtém os dados de faturamento (CPF/CNPJ e Endereço) salvos para o Tenant atual.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(TenantBillingProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetProfile(CancellationToken cancellationToken = default)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty)
        {
            return BadRequestProblem("X-Tenant-ID header é obrigatório.");
        }

        var profile = await _billingProfileService.GetProfileAsync(tenantId, cancellationToken);
        if (profile is null)
        {
            return NotFoundProblem("Perfil de faturamento não encontrado para este Tenant.");
        }

        return Ok(profile);
    }

    /// <summary>
    /// Cadastra ou atualiza os dados fiscais e de endereço de faturamento do Tenant atual.
    /// </summary>
    [HttpPut]
    [ProducesResponseType(typeof(TenantBillingProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpsertProfile(
        [FromBody] UpsertTenantBillingProfileRequest request,
        CancellationToken cancellationToken = default)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty)
        {
            return BadRequestProblem("X-Tenant-ID header é obrigatório.");
        }

        if (!ModelState.IsValid)
        {
            return BadRequestProblem("Dados de faturamento inválidos.");
        }

        try
        {
            var result = await _billingProfileService.UpsertProfileAsync(tenantId, request, cancellationToken);
            _logger.LogInformation("Perfil de faturamento atualizado com sucesso para o Tenant {TenantId}", tenantId);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Erro de validação no perfil de faturamento para o Tenant {TenantId}: {Message}", tenantId, ex.Message);
            return BadRequestProblem(ex.Message);
        }
    }
}
