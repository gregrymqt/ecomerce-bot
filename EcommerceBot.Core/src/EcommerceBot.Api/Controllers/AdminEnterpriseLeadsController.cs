using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Admin;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/admin/enterprise-leads")]
[Authorize(Roles = "ADMIN")]
public class AdminEnterpriseLeadsController : BaseApiController
{
    private readonly IEnterpriseLeadService _enterpriseLeadService;

    public AdminEnterpriseLeadsController(IEnterpriseLeadService enterpriseLeadService)
    {
        _enterpriseLeadService = enterpriseLeadService;
    }

    /// <summary>
    /// Lista leads corporativos com paginação, busca e métricas de funil do Mini-CRM.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetLeads(
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        try
        {
            var response = await _enterpriseLeadService.GetLeadsAsync(status, search, page, pageSize);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    /// <summary>
    /// Atualiza o estágio no Kanban/Pipeline (PENDING, CONTACTED, QUALIFIED, CONVERTED, REJECTED) e anotações internas.
    /// </summary>
    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(
        [FromRoute] Guid id,
        [FromBody] UpdateEnterpriseLeadStatusRequest request)
    {
        try
        {
            var success = await _enterpriseLeadService.UpdateLeadStatusAsync(id, request);
            if (!success)
            {
                return NotFound(new { Message = "Lead corporativo não encontrado." });
            }
            return Ok(new { Success = true, Message = "Status do lead atualizado com sucesso." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    /// <summary>
    /// Provisiona a Conta Enterprise (Cria Tenant com Plano ENTERPRISE e Usuário com role TENANT_ADMIN).
    /// </summary>
    [HttpPost("{id:guid}/provision")]
    public async Task<IActionResult> ProvisionAccount(
        [FromRoute] Guid id,
        [FromBody] ProvisionEnterpriseAccountRequest request)
    {
        try
        {
            var response = await _enterpriseLeadService.ProvisionEnterpriseAccountAsync(id, request);
            return Ok(response);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { Message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { Message = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }
}
