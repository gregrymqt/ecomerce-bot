using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;

namespace EcommerceBot.Api.Middlewares;

/// <summary>
/// Middleware de segurança HTTP para mitigar Clickjacking, MIME-sniffing, XSS e vazamento de informações.
/// Em conformidade com o checklist de produção da skill production-security.
/// </summary>
public sealed class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;
    private readonly bool _isDevelopment;

    public SecurityHeadersMiddleware(RequestDelegate next, IHostEnvironment environment)
    {
        _next = next ?? throw new ArgumentNullException(nameof(next));
        _isDevelopment = environment?.IsDevelopment() ?? false;
    }

    public Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(state =>
        {
            var ctx = (HttpContext)state;
            var headers = ctx.Response.Headers;

            // Proteção contra MIME Sniffing
            headers.XContentTypeOptions = "nosniff";

            // Proteção contra Clickjacking
            headers.XFrameOptions = "DENY";

            // Controle de referrers para limitar vazamento de dados de URLs em requisições externas
            headers["Referrer-Policy"] = "strict-origin-when-cross-origin";

            // Restrição de APIs sensíveis do navegador (câmera, microfone, geolocalização)
            headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()";

            // Content Security Policy defensivo para API REST
            headers.ContentSecurityPolicy = "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self';";

            // HSTS estrito ativado exclusivamente fora de Development para não prejudicar ambiente local com HTTP/certificados auto-assinados
            if (!_isDevelopment)
            {
                headers.StrictTransportSecurity = "max-age=31536000; includeSubDomains; preload";
            }

            // Ocultação de assinaturas de tecnologia (evita fingerprinting de frameworks/servidores)
            headers.Remove("Server");
            headers.Remove("X-Powered-By");

            return Task.CompletedTask;
        }, context);

        return _next(context);
    }
}
