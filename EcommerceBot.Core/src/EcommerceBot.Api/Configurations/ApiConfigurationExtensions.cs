using System.Linq;
using System.Text.Json.Serialization;
using EcommerceBot.Api.Services;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace EcommerceBot.Api.Configurations;

/// <summary>
/// Métodos de extensão para registro limpo de serviços e middlewares da camada de apresentação/WebAPI.
/// </summary>
public static class ApiConfigurationExtensions
{
    /// <summary>
    /// Registra configurações de serialização JSON, contexto de tenant, controllers, Razor views, OpenAPI,
    /// suporte nativo a ProblemDetails (RFC 7807) e sondas de saúde segregadas.
    /// </summary>
    public static IServiceCollection AddApiServices(this IServiceCollection services)
    {
        services.ConfigureHttpJsonOptions(options =>
        {
            options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
            options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        });

        // Suporte a RFC 7807 (ProblemDetails)
        services.AddProblemDetails();

        services.AddHttpContextAccessor();
        services.AddScoped<ITenantContext, TenantContext>();
        services.AddControllersWithViews();
        services.AddOpenApi();

        // Configuração de Health Checks segregados (/health/live e /health/ready)
        services.AddHealthChecks()
            .AddCheck("self", () => HealthCheckResult.Healthy("Processo Kestrel operacional."), tags: new[] { "live" })
            .AddCheck<ReadinessHealthCheck>("database_and_cache", tags: new[] { "ready" });

        return services;
    }

    /// <summary>
    /// Mapeia endpoints padronizados de saúde segregados conforme Seção 8.3 do SKILL.md.
    /// </summary>
    public static WebApplication MapApiHealthChecks(this WebApplication app)
    {
        // /health/live: Sonda leve de integridade do processo (sem I/O externo)
        app.MapHealthChecks("/health/live", new HealthCheckOptions
        {
            Predicate = check => check.Tags.Contains("live"),
            ResponseWriter = async (context, report) =>
            {
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsJsonAsync(new
                {
                    status = report.Status.ToString(),
                    service = "EcommerceBot.Core.API",
                    check = "live"
                });
            }
        });

        // /health/ready: Sonda de prontidão testando SQL Server e Redis
        app.MapHealthChecks("/health/ready", new HealthCheckOptions
        {
            Predicate = check => check.Tags.Contains("ready"),
            ResponseWriter = async (context, report) =>
            {
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsJsonAsync(new
                {
                    status = report.Status.ToString(),
                    service = "EcommerceBot.Core.API",
                    check = "ready",
                    entries = report.Entries.Select(e => new
                    {
                        name = e.Key,
                        status = e.Value.Status.ToString(),
                        description = e.Value.Description,
                        data = e.Value.Data
                    })
                });
            }
        });

        // /health: Alias com retrocompatibilidade para monitoramentos existentes
        app.MapHealthChecks("/health", new HealthCheckOptions
        {
            Predicate = _ => true,
            ResponseWriter = async (context, report) =>
            {
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsJsonAsync(new
                {
                    status = report.Status.ToString(),
                    service = "EcommerceBot.Core.API"
                });
            }
        });

        return app;
    }

    /// <summary>
    /// Configura o middleware de Forwarded Headers para suporte a proxies reversos, Ngrok e terminação SSL.
    /// </summary>
    public static WebApplication UseForwardedHeadersConfiguration(this WebApplication app)
    {
        app.UseForwardedHeaders(new ForwardedHeadersOptions
        {
            ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
        });

        return app;
    }
}
