using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Interfaces;
using EcommerceBot.Infrastructure.Data;
using EcommerceBot.Infrastructure.Gateways;
using EcommerceBot.Infrastructure.Services;
using Microsoft.Extensions.DependencyInjection;

namespace EcommerceBot.Infrastructure.Configurations;

/// <summary>
/// Configuração de injeção de dependências por convenção via Scrutor (DIP).
/// </summary>
public static class DependencyInjectionExtensions
{
    public static IServiceCollection AddDependencyInjection(this IServiceCollection services)
    {
        // 1. Singletons e Serviços Especiais de Infraestrutura
        services.AddSingleton<IDbConnectionFactory, DbConnectionFactory>();
        services.AddSingleton<IAesGcmCryptoService, AesGcmCryptoService>();
        services.AddScoped<IEcommerceGatewayFactory, EcommerceGatewayFactory>();
        services.AddScoped<IRazorTemplateRenderer, RazorViewToStringRenderer>();

        // 2. Escaneamento automático por convenção via Scrutor (Infrastructure + Application)
        services.Scan(scan => scan
            .FromAssembliesOf(typeof(DbConnectionFactory), typeof(IAuthService))
            // Repositórios Dapper (*Repository -> I*Repository)
            .AddClasses(classes => classes.Where(type =>
                type.Name.EndsWith("Repository") &&
                !type.IsAbstract &&
                !type.IsInterface))
            .AsMatchingInterface()
            .WithScopedLifetime()

            // Serviços (*Service -> I*Service)
            .AddClasses(classes => classes.Where(type =>
                type.Name.EndsWith("Service") &&
                !type.Name.Equals("RedisService") && // Gerenciado no RedisExtensions como Singleton
                !type.Name.Equals("AesGcmCryptoService") && // Gerenciado como Singleton
                !type.Name.Equals("DiscordAlertService") && // Gerenciado no GatewayExtensions via AddHttpClient
                !type.IsAbstract &&
                !type.IsInterface))
            .AsMatchingInterface()
            .WithScopedLifetime());

        return services;
    }
}
