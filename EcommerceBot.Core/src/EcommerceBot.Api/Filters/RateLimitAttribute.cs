using System;
using System.Diagnostics;
using System.Threading.Tasks;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;

namespace EcommerceBot.Api.Filters;

/// <summary>
/// Action Filter para Rate Limiting distribuído com bloqueio temporário de IP via Redis
/// e respostas de erro em conformidade com a RFC 7807 (ProblemDetails).
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
public class RateLimitAttribute : Attribute, IAsyncActionFilter
{
    /// <summary>
    /// Limite máximo de requisições permitidas dentro da janela.
    /// </summary>
    public int MaxRequests { get; set; } = 60;

    /// <summary>
    /// Tamanho da janela temporal em segundos (padrão: 60s).
    /// </summary>
    public int WindowSeconds { get; set; } = 60;

    /// <summary>
    /// Duração do bloqueio do IP em segundos caso exceda o limite (padrão: 300s / 5 minutos).
    /// </summary>
    public int BlockDurationSeconds { get; set; } = 300;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var httpContext = context.HttpContext;
        var redisService = httpContext.RequestServices.GetService<IRedisService>();

        // Se Redis não estiver disponível, prossegue fail-open para não interromper a API
        if (redisService == null)
        {
            await next();
            return;
        }

        var (clientKey, clientType, _) = ResolveClientIdentifier(httpContext);
        var routeKey = context.ActionDescriptor.DisplayName?.Replace(" ", "_") ?? "global";
        var blockKey = $"rate_limit:blocked:{clientKey}";

        // 1. Verifica se o cliente (Tenant ou IP) está em ban/bloqueio temporário
        if (await redisService.KeyExistsAsync(blockKey))
        {
            httpContext.Response.Headers.Append("Retry-After", BlockDurationSeconds.ToString());
            var message = clientType == "Tenant"
                ? "Sua organização foi temporariamente bloqueada por excesso de requisições suspeitas."
                : "Seu IP foi temporariamente bloqueado por excesso de requisições suspeitas.";

            context.Result = CreateProblemResult(
                httpContext,
                message,
                BlockDurationSeconds);
            return;
        }

        // 2. Incrementa contador de requisições no Redis
        var counterKey = $"rate_limit:req:{routeKey}:{clientKey}";
        var currentCount = await redisService.IncrementAsync(counterKey, 1, TimeSpan.FromSeconds(WindowSeconds));

        // 3. Se excedeu o limite máximo, aplica o bloqueio temporário
        if (currentCount > MaxRequests)
        {
            await redisService.SetAsync(blockKey, "blocked", TimeSpan.FromSeconds(BlockDurationSeconds));

            httpContext.Response.Headers.Append("Retry-After", BlockDurationSeconds.ToString());
            var blockMessage = clientType == "Tenant"
                ? $"Limite de requisições excedido para a sua organização ({MaxRequests} req/{WindowSeconds}s). Acesso bloqueado por {BlockDurationSeconds} segundos."
                : $"Limite de requisições excedido ({MaxRequests} req/{WindowSeconds}s). IP bloqueado por {BlockDurationSeconds} segundos.";

            context.Result = CreateProblemResult(
                httpContext,
                blockMessage,
                BlockDurationSeconds);
            return;
        }

        // Adiciona headers informativos de rate limit na resposta
        httpContext.Response.Headers.Append("X-RateLimit-Limit", MaxRequests.ToString());
        httpContext.Response.Headers.Append("X-RateLimit-Remaining", Math.Max(0, MaxRequests - currentCount).ToString());

        await next();
    }

    private static ObjectResult CreateProblemResult(HttpContext context, string detail, int retryAfterSeconds)
    {
        var problem = new ProblemDetails
        {
            Type = "https://datatracker.ietf.org/doc/html/rfc7807",
            Title = "Too Many Requests",
            Status = StatusCodes.Status429TooManyRequests,
            Detail = detail,
            Instance = context.Request.Path
        };
        problem.Extensions["retryAfterSeconds"] = retryAfterSeconds;
        problem.Extensions["correlationId"] = Activity.Current?.Id ?? context.TraceIdentifier;
        problem.Extensions["error"] = "Too Many Requests";
        problem.Extensions["message"] = detail;

        return new ObjectResult(problem)
        {
            StatusCode = StatusCodes.Status429TooManyRequests,
            ContentTypes = { "application/problem+json" }
        };
    }

    private static string GetClientIp(HttpContext context)
    {
        if (context.Request.Headers.TryGetValue("X-Forwarded-For", out var forwardedFor) && !string.IsNullOrWhiteSpace(forwardedFor))
        {
            var firstIp = forwardedFor.ToString().Split(',')[0].Trim();
            if (!string.IsNullOrEmpty(firstIp)) return firstIp;
        }

        if (context.Request.Headers.TryGetValue("X-Real-IP", out var realIp) && !string.IsNullOrWhiteSpace(realIp))
        {
            return realIp.ToString().Trim();
        }

        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown_ip";
    }

    private static (string ClientKey, string ClientType, string ClientIdentifier) ResolveClientIdentifier(HttpContext httpContext)
    {
        // 1. Tenta resolver via ITenantContext Scoped injetado pelo TenantHeaderMiddleware
        var tenantContext = httpContext.RequestServices.GetService<ITenantContext>();
        if (tenantContext != null && tenantContext.TenantId != Guid.Empty)
        {
            return ($"tenant:{tenantContext.TenantId}", "Tenant", tenantContext.TenantId.ToString());
        }

        // 2. Tenta resolver via claim JWT de usuário autenticado
        if (httpContext.User.Identity?.IsAuthenticated == true)
        {
            var tenantClaim = httpContext.User.FindFirst("tenantId")?.Value;
            if (Guid.TryParse(tenantClaim, out var claimTenantId) && claimTenantId != Guid.Empty)
            {
                return ($"tenant:{claimTenantId}", "Tenant", claimTenantId.ToString());
            }
        }

        // 3. Tenta resolver via header X-Tenant-ID
        if (httpContext.Request.Headers.TryGetValue("X-Tenant-ID", out var headerVal) &&
            Guid.TryParse(headerVal.ToString(), out var headerTenantId) && headerTenantId != Guid.Empty)
        {
            return ($"tenant:{headerTenantId}", "Tenant", headerTenantId.ToString());
        }

        // 4. Fallback para rotas públicas/anônimas: Rate limit por IP
        var ip = GetClientIp(httpContext);
        return ($"ip:{ip}", "IP", ip);
    }
}
