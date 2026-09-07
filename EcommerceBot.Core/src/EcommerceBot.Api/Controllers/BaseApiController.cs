using System;
using System.Diagnostics;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers;

/// <summary>
/// Controlador base global abstrato para todas as Controllers da API.
/// Impõe [ApiController] e [Authorize] por padrão, fornecendo helpers de contexto do usuário, tenant
/// e métodos utilitários para respostas RFC 7807 (ProblemDetails).
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
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirst("sub")?.Value;
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

    /// <summary>
    /// Constrói e retorna uma resposta padronizada RFC 7807 (ProblemDetails) com Content-Type application/problem+json.
    /// </summary>
    protected IActionResult ProblemResponse(int statusCode, string title, string detail)
    {
        var problem = new ProblemDetails
        {
            Type = "https://datatracker.ietf.org/doc/html/rfc7807",
            Title = title,
            Status = statusCode,
            Detail = detail,
            Instance = HttpContext.Request.Path
        };
        problem.Extensions["correlationId"] = Activity.Current?.Id ?? HttpContext.TraceIdentifier;
        problem.Extensions["error"] = title;
        problem.Extensions["message"] = detail;

        return new ObjectResult(problem)
        {
            StatusCode = statusCode,
            ContentTypes = { "application/problem+json" }
        };
    }

    protected IActionResult BadRequestProblem(string detail, string title = "Bad Request") =>
        ProblemResponse(StatusCodes.Status400BadRequest, title, detail);

    protected IActionResult NotFoundProblem(string detail, string title = "Not Found") =>
        ProblemResponse(StatusCodes.Status404NotFound, title, detail);

    protected IActionResult ForbiddenProblem(string detail, string title = "Forbidden") =>
        ProblemResponse(StatusCodes.Status403Forbidden, title, detail);

    protected IActionResult ConflictProblem(string detail, string title = "Conflict") =>
        ProblemResponse(StatusCodes.Status409Conflict, title, detail);

    protected IActionResult UnauthorizedProblem(string detail, string title = "Unauthorized") =>
        ProblemResponse(StatusCodes.Status401Unauthorized, title, detail);
}
