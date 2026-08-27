using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
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

    private static readonly string[] PublicPathPrefixes = new[]
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
        "/api/v1/checkout/status"
    };

    public async Task InvokeAsync(HttpContext context, ITenantContext tenantContext, ITenantRepository tenantRepository)
    {
        var path = context.Request.Path.Value ?? string.Empty;

        // Isenção para rotas públicas e webhooks externos
        if (PublicPathPrefixes.Any(p => path.StartsWith(p, StringComparison.OrdinalIgnoreCase)) ||
            (path.Equals("/api/v1/plans", StringComparison.OrdinalIgnoreCase) && HttpMethods.IsGet(context.Request.Method)))
        {
            // Se o header foi fornecido opcionalmente na rota pública, tenta popular o contexto
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
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(new { detail = "O header X-Tenant-ID é obrigatório." });
            return;
        }

        if (!Guid.TryParse(tenantIdHeader, out var tenantId))
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(new { detail = "O X-Tenant-ID fornecido não é um GUID válido." });
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
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    await context.Response.WriteAsJsonAsync(new { detail = "Acesso negado: o token de autenticação não pertence ao Tenant solicitado." });
                    return;
                }
            }
        }

        // Valida se o Tenant existe e está ativo (via Dapper/Cache)
        var tenant = await tenantRepository.GetByIdAsync(tenantId);
        if (tenant == null)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new { detail = "Tenant inválido ou inativo." });
            return;
        }

        // Popula o TenantContext Scoped para estar disponível nos Services e Repositories
        tenantContext.SetTenantId(tenantId);

        await _next(context);
    }
}
