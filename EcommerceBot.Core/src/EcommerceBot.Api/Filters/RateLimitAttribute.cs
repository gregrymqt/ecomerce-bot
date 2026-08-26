using System;
using System.Threading.Tasks;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;

namespace EcommerceBot.Api.Filters;

/// <summary>
/// Action Filter para Rate Limiting distribuído com bloqueio temporário de IP via Redis.
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

        var ip = GetClientIp(httpContext);
        var routeKey = context.ActionDescriptor.DisplayName?.Replace(" ", "_") ?? "global";
        var blockKey = $"rate_limit:blocked:{ip}";

        // 1. Verifica se o IP está em ban/bloqueio temporário
        if (await redisService.KeyExistsAsync(blockKey))
        {
            httpContext.Response.Headers.Append("Retry-After", BlockDurationSeconds.ToString());
            context.Result = new ObjectResult(new
            {
                statusCode = StatusCodes.Status429TooManyRequests,
                error = "Too Many Requests",
                message = "Seu IP foi temporariamente bloqueado por excesso de requisições suspeitas.",
                retryAfterSeconds = BlockDurationSeconds
            })
            {
                StatusCode = StatusCodes.Status429TooManyRequests
            };
            return;
        }

        // 2. Incrementa contador de requisições no Redis
        var counterKey = $"rate_limit:req:{routeKey}:{ip}";
        var currentCount = await redisService.IncrementAsync(counterKey, 1, TimeSpan.FromSeconds(WindowSeconds));

        // 3. Se excedeu o limite máximo, aplica o bloqueio de IP
        if (currentCount > MaxRequests)
        {
            await redisService.SetAsync(blockKey, "blocked", TimeSpan.FromSeconds(BlockDurationSeconds));

            httpContext.Response.Headers.Append("Retry-After", BlockDurationSeconds.ToString());
            context.Result = new ObjectResult(new
            {
                statusCode = StatusCodes.Status429TooManyRequests,
                error = "Too Many Requests",
                message = $"Limite de requisições excedido ({MaxRequests} req/{WindowSeconds}s). IP bloqueado por {BlockDurationSeconds} segundos.",
                retryAfterSeconds = BlockDurationSeconds
            })
            {
                StatusCode = StatusCodes.Status429TooManyRequests
            };
            return;
        }

        // Adiciona headers informativos de rate limit na resposta
        httpContext.Response.Headers.Append("X-RateLimit-Limit", MaxRequests.ToString());
        httpContext.Response.Headers.Append("X-RateLimit-Remaining", Math.Max(0, MaxRequests - currentCount).ToString());

        await next();
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
}
