using EcommerceBot.Api.Middlewares;
using Microsoft.AspNetCore.Builder;

namespace EcommerceBot.Api.Configurations;

/// <summary>
/// Métodos de extensão para registro limpo do SecurityHeadersMiddleware no pipeline HTTP.
/// Segue a Regra 10 do AGENTS.md (Clean Bootstrapping sem lambdas ou lógica inline no Program.cs).
/// </summary>
public static class SecurityHeadersExtensions
{
    /// <summary>
    /// Adiciona o middleware de cabeçalhos de segurança HTTP ao pipeline de requisições.
    /// </summary>
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app)
    {
        return app.UseMiddleware<SecurityHeadersMiddleware>();
    }
}
