using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Auth;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers
{
    [Route("api/v1/sso")]
    [Authorize(Roles = "ADMIN,TENANT_ADMIN")]
    public class TenantSsoController : BaseApiController
    {
        private readonly ITenantSsoService _tenantSsoService;

        public TenantSsoController(ITenantSsoService tenantSsoService)
        {
            _tenantSsoService = tenantSsoService;
        }

        /// <summary>
        /// Lista todos os papéis (Roles) canônicos disponíveis no sistema.
        /// </summary>
        [HttpGet("roles")]
        public async Task<IActionResult> GetRoles()
        {
            try
            {
                var roles = await _tenantSsoService.GetRolesAsync();
                return Ok(roles);
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        /// <summary>
        /// Lista os mapeamentos de grupos do IdP (Okta, Azure AD, SAML) para o Tenant autenticado.
        /// </summary>
        [HttpGet("mappings")]
        public async Task<IActionResult> GetMappings()
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId == Guid.Empty)
                {
                    return BadRequest(new { Message = "Tenant não identificado no contexto da requisição." });
                }

                var mappings = await _tenantSsoService.GetMappingsByTenantIdAsync(tenantId);
                return Ok(mappings);
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        /// <summary>
        /// Cadastra um novo mapeamento de grupo do IdP para um papel do sistema.
        /// </summary>
        [HttpPost("mappings")]
        public async Task<IActionResult> CreateMapping([FromBody] CreateTenantSsoMappingRequest request)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId == Guid.Empty)
                {
                    return BadRequest(new { Message = "Tenant não identificado no contexto da requisição." });
                }

                var result = await _tenantSsoService.CreateMappingAsync(tenantId, request);
                return CreatedAtAction(nameof(GetMappings), new { id = result.Id }, result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { Message = ex.Message });
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

        /// <summary>
        /// Atualiza um mapeamento existente de grupo do IdP.
        /// </summary>
        [HttpPut("mappings/{id:guid}")]
        public async Task<IActionResult> UpdateMapping([FromRoute] Guid id, [FromBody] UpdateTenantSsoMappingRequest request)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId == Guid.Empty)
                {
                    return BadRequest(new { Message = "Tenant não identificado no contexto da requisição." });
                }

                var success = await _tenantSsoService.UpdateMappingAsync(id, tenantId, request);
                if (!success)
                {
                    return NotFound(new { Message = "Mapeamento SSO não encontrado." });
                }
                return Ok(new { Success = true, Message = "Mapeamento atualizado com sucesso." });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        /// <summary>
        /// Remove um mapeamento de grupo do IdP.
        /// </summary>
        [HttpDelete("mappings/{id:guid}")]
        public async Task<IActionResult> DeleteMapping([FromRoute] Guid id)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId == Guid.Empty)
                {
                    return BadRequest(new { Message = "Tenant não identificado no contexto da requisição." });
                }

                var success = await _tenantSsoService.DeleteMappingAsync(id, tenantId);
                if (!success)
                {
                    return NotFound(new { Message = "Mapeamento SSO não encontrado." });
                }
                return Ok(new { Success = true, Message = "Mapeamento removido com sucesso." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }
    }
}
