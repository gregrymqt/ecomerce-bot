using System;
using System.Collections.Generic;
using EcommerceBot.Infrastructure.Options;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace EcommerceBot.Infrastructure.Configurations;

/// <summary>
/// Configuração modular de política CORS com suporte a credenciais (cookies HttpOnly) e isolamento multi-tenant.
/// </summary>
public static class CorsExtensions
{
    public static IServiceCollection AddCorsConfiguration(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        var corsOptions = configuration.GetSection(CorsOptions.SectionName).Get<CorsOptions>() ?? new CorsOptions();
        var allowedOrigins = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        if (corsOptions.AllowedOrigins is { Count: > 0 })
        {
            foreach (var origin in corsOptions.AllowedOrigins)
            {
                if (!string.IsNullOrWhiteSpace(origin) && (environment.IsDevelopment() || !IsLoopbackOrigin(origin)))
                {
                    allowedOrigins.Add(origin.TrimEnd('/'));
                }
            }
        }

        if (environment.IsDevelopment())
        {
            allowedOrigins.Add("http://localhost:5173");
            allowedOrigins.Add("https://localhost:5173");
            allowedOrigins.Add("http://localhost:3000");
        }

        // Inclui App:FrontendUrl quando configurado e seguro para o ambiente
        var frontendUrl = configuration["App:FrontendUrl"];
        if (!string.IsNullOrWhiteSpace(frontendUrl) && (environment.IsDevelopment() || !IsLoopbackOrigin(frontendUrl)))
        {
            allowedOrigins.Add(frontendUrl.TrimEnd('/'));
        }

        services.AddCors(options =>
        {
            options.AddPolicy("DefaultCorsPolicy", policy =>
            {
                policy.WithOrigins([.. allowedOrigins])
                      .AllowAnyHeader()
                      .AllowAnyMethod()
                      .AllowCredentials()
                      .WithExposedHeaders("X-Tenant-ID", "Content-Disposition");
            });
        });

        return services;
    }

    private static bool IsLoopbackOrigin(string origin)
    {
        return Uri.TryCreate(origin, UriKind.Absolute, out var uri) && uri.IsLoopback;
    }
}