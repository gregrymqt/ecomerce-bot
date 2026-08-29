using System;
using System.Collections.Generic;
using System.Linq;
using EcommerceBot.Infrastructure.Options;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace EcommerceBot.Infrastructure.Configurations;

/// <summary>
/// Configuração modular de política CORS com suporte a credenciais (cookies HttpOnly) e isolamento multi-tenant.
/// </summary>
public static class CorsExtensions
{
    public static IServiceCollection AddCorsConfiguration(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var corsOptions = configuration.GetSection(CorsOptions.SectionName).Get<CorsOptions>() ?? new CorsOptions();
        var allowedOrigins = new HashSet<string>(corsOptions.AllowedOrigins ?? [], StringComparer.OrdinalIgnoreCase)
        {
            // Fallbacks seguros de desenvolvimento
            "http://localhost:5173",
            "http://localhost:3000"
        };

        // Inclui App:FrontendUrl se configurado no appsettings/ambiente
        var frontendUrl = configuration["App:FrontendUrl"];
        if (!string.IsNullOrWhiteSpace(frontendUrl))
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
}