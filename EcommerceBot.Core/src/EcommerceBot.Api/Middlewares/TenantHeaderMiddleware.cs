using System;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Api.Middlewares;

public class TenantHeaderMiddleware
{
    private readonly RequestDelegate _next;

    public TenantHeaderMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    private static readonly string[] ExemptPathPrefixes = new[]
    {
        "/health",
        "/openapi",
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/google",
        "/api/v1/auth/sso-enterprise",
        "/api/v1/webhooks",
        "/api/v1/emails/webhooks",
        "/api/v1/shopify/webhooks",
        "/api/v1/shopify/oauth",
        "/api/v1/nuvemshop/webhooks",
        "/api/v1/nuvemshop/oauth",
        "/api/v1/checkout/pix",
        "/api/v1/checkout/status",
        "/api/v1/admin",
        "/api/v1/plans",
        "/api/v1/wallet/credit-packages",
        "/api/v1/analytics/traffic/visit"
    };

    public async Task InvokeAsync(HttpContext context, ITenantContext tenantContext, ITenantRepository tenantRepository)
    {
        var path = context.Request.Path.Value ?? string.Empty;

        // Isenção para rotas públicas, webhooks externos e rotas globais da plataforma/administração
        if (ExemptPathPrefixes.Any(p => path.StartsWith(p, StringComparison.OrdinalIgnoreCase)))
        {
            // Se o header foi fornecido opcionalmente, tenta popular o contexto
            if (context.Request.Headers.TryGetValue("X-Tenant-ID", out var optionalTenantIdHeader) &&
                Guid.TryParse(optionalTenantIdHeader, out var optionalTenantId))
            {
                tenantContext.SetTenantId(optionalTenantId);
            }

            await _next(context);
            return;
        }

        if (!context.Request.Headers.TryGetValue("X-Tenant-ID", out var tenantIdHeader))
        {
            await WriteProblemResponseAsync(context, StatusCodes.Status400BadRequest, "Missing Tenant Header", "O header X-Tenant-ID é obrigatório.");
            return;
        }

        if (!Guid.TryParse(tenantIdHeader, out var tenantId))
        {
            await WriteProblemResponseAsync(context, StatusCodes.Status400BadRequest, "Invalid Tenant Header", "O X-Tenant-ID fornecido não é um GUID válido.");
            return;
        }

        // Validação Estrita de Multi-Tenancy (Anti-IDOR / Tenant Spoofing):
        // Se o usuário está autenticado e não é ADMIN, valida se o TenantId do header confere com o claim do JWT
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var userRole = context.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
            var userTenantClaim = context.User.FindFirst("tenantId")?.Value;

            if (userRole != "ADMIN" && !string.IsNullOrEmpty(userTenantClaim))
            {
                if (!Guid.TryParse(userTenantClaim, out var claimTenantId) || claimTenantId != tenantId)
                {
                    await WriteProblemResponseAsync(context, StatusCodes.Status403Forbidden, "Tenant Forbidden", "Acesso negado: o token de autenticação não pertence ao Tenant solicitado.");
                    return;
                }
            }
        }

        // Valida se o Tenant existe e está ativo (via Dapper/Cache)
        var tenant = await tenantRepository.GetByIdAsync(tenantId);
        if (tenant == null)
        {
            await WriteProblemResponseAsync(context, StatusCodes.Status401Unauthorized, "Tenant Unauthorized", "Tenant inválido ou inativo.");
            return;
        }

        // Popula o TenantContext Scoped para estar disponível nos Services e Repositories
        tenantContext.SetTenantId(tenantId);

        await _next(context);
    }

    private static async Task WriteProblemResponseAsync(HttpContext context, int statusCode, string title, string detail)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/problem+json";

        var problem = new ProblemDetails
        {
            Type = "https://datatracker.ietf.org/doc/html/rfc7807",
            Title = title,
            Status = statusCode,
            Detail = detail,
            Instance = context.Request.Path
        };
        problem.Extensions["correlationId"] = Activity.Current?.Id ?? context.TraceIdentifier;
        problem.Extensions["detail"] = detail;
        problem.Extensions["message"] = detail;

        await context.Response.WriteAsJsonAsync(problem, context.RequestAborted);
    }
}
