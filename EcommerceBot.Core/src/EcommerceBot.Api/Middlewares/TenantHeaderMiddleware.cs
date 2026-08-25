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

    public async Task InvokeAsync(HttpContext context, ITenantContext tenantContext, ITenantRepository tenantRepository)
    {
        // Ignorar rotas públicas como health checks (caso necessário)
        if (context.Request.Path.StartsWithSegments("/health"))
        {
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
