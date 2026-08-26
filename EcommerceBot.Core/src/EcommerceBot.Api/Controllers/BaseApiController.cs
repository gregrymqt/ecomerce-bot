using System;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers;

/// <summary>
/// Controlador base global abstrato para todas as Controllers da API.
/// Impõe [ApiController] e [Authorize] por padrão, fornecendo helpers de contexto do usuário e tenant.
/// </summary>
[ApiController]
[Authorize]
public abstract class BaseApiController : ControllerBase
{
    /// <summary>
    /// Obtém o TenantId do cabeçalho X-Tenant-ID ou da claim 'tenantId' do JWT.
    /// </summary>
    protected Guid CurrentTenantId
    {
        get
        {
            if (HttpContext.Request.Headers.TryGetValue("X-Tenant-ID", out var tenantHeader) &&
                Guid.TryParse(tenantHeader.ToString(), out var headerTenantId) &&
                headerTenantId != Guid.Empty)
            {
                return headerTenantId;
            }

            var claimTenant = User.FindFirst("tenantId")?.Value;
            if (!string.IsNullOrEmpty(claimTenant) && Guid.TryParse(claimTenant, out var claimTenantId))
            {
                return claimTenantId;
            }

            return Guid.Empty;
        }
    }

    /// <summary>
    /// Obtém o UserId a partir do NameIdentifier do JWT.
    /// </summary>
    protected Guid CurrentUserId
    {
        get
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(userIdStr, out var userId) ? userId : Guid.Empty;
        }
    }

    /// <summary>
    /// Obtém o Email do usuário autenticado no JWT.
    /// </summary>
    protected string CurrentUserEmail => User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;

    /// <summary>
    /// Obtém a Role do usuário autenticado.
    /// </summary>
    protected string CurrentUserRole => User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;

    /// <summary>
    /// Indica se o usuário atual possui a Role ADMIN.
    /// </summary>
    protected bool IsAdmin => string.Equals(CurrentUserRole, "ADMIN", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Indica se o usuário/serviço atual possui a Role SYSTEM.
    /// </summary>
    protected bool IsSystem => string.Equals(CurrentUserRole, "SYSTEM", StringComparison.OrdinalIgnoreCase);
}
