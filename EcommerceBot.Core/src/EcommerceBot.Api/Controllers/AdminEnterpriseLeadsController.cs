using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Admin;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/admin/enterprise-leads")]
[Authorize(Roles = "ADMIN")]
public class AdminEnterpriseLeadsController : BaseApiController
{
    private readonly IEnterpriseLeadService _enterpriseLeadService;
    private readonly ILogger<AdminEnterpriseLeadsController> _logger;

    public AdminEnterpriseLeadsController(
        IEnterpriseLeadService enterpriseLeadService,
        ILogger<AdminEnterpriseLeadsController> logger)
    {
        _enterpriseLeadService = enterpriseLeadService;
        _logger = logger;
    }

    /// <summary>
    /// Lista leads corporativos com paginacao, busca e metricas de funil do Mini-CRM.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(EnterpriseLeadsListResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetLeads(
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _enterpriseLeadService.GetLeadsAsync(status, search, page, pageSize, cancellationToken);
            return Ok(response);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Parametros invalidos ao listar leads enterprise");
            return BadRequestProblem(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro inesperado ao listar leads enterprise");
            return ProblemResponse(StatusCodes.Status500InternalServerError, "Erro ao listar leads enterprise", ex.Message);
        }
    }

    /// <summary>
    /// Atualiza o estagio no Kanban/Pipeline (PENDING, CONTACTED, QUALIFIED, CONVERTED, REJECTED) e anotacoes internas.
    /// </summary>
    [HttpPatch("{id:guid}/status")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStatus(
        [FromRoute] Guid id,
        [FromBody] UpdateEnterpriseLeadStatusRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var success = await _enterpriseLeadService.UpdateLeadStatusAsync(id, request, cancellationToken);
            if (!success)
            {
                return NotFoundProblem("Lead corporativo nao encontrado.");
            }
            return Ok(new { Success = true, Message = "Status do lead atualizado com sucesso." });
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Dados invalidos ao atualizar status do lead {LeadId}", id);
            return BadRequestProblem(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro inesperado ao atualizar status do lead {LeadId}", id);
            return ProblemResponse(StatusCodes.Status500InternalServerError, "Erro ao atualizar status do lead", ex.Message);
        }
    }

    /// <summary>
    /// Provisiona a Conta Enterprise (Cria Tenant com Plano ENTERPRISE e Usuario com role TENANT_ADMIN).
    /// </summary>
    [HttpPost("{id:guid}/provision")]
    [ProducesResponseType(typeof(ProvisionEnterpriseAccountResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ProvisionAccount(
        [FromRoute] Guid id,
        [FromBody] ProvisionEnterpriseAccountRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _enterpriseLeadService.ProvisionEnterpriseAccountAsync(id, request, cancellationToken);
            return Ok(response);
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning(ex, "Lead enterprise {LeadId} nao encontrado para provisionamento", id);
            return NotFoundProblem(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Conflito ao provisionar lead enterprise {LeadId}", id);
            return ConflictProblem(ex.Message);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Dados invalidos no provisionamento do lead enterprise {LeadId}", id);
            return BadRequestProblem(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro inesperado ao provisionar conta enterprise para lead {LeadId}", id);
            return ProblemResponse(StatusCodes.Status500InternalServerError, "Erro no provisionamento de conta enterprise", ex.Message);
        }
    }
}