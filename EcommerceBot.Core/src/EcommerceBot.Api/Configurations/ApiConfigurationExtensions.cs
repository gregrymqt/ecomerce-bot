using System.Text.Json.Serialization;
using EcommerceBot.Api.Services;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.DependencyInjection;

namespace EcommerceBot.Api.Configurations;

/// <summary>
/// Métodos de extensão para registro limpo de serviços e middlewares da camada de apresentação/WebAPI.
/// </summary>
public static class ApiConfigurationExtensions
{
    /// <summary>
    /// Registra configurações de serialização JSON, contexto de tenant, controllers, Razor views e OpenAPI.
    /// </summary>
    public static IServiceCollection AddApiServices(this IServiceCollection services)
    {
        services.ConfigureHttpJsonOptions(options =>
        {
            options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
            options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        });

        services.AddScoped<ITenantContext, TenantContext>();
        services.AddControllersWithViews();
        services.AddOpenApi();

        return services;
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
