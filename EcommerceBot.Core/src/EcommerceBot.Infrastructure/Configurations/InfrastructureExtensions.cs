using EcommerceBot.Infrastructure.Options;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace EcommerceBot.Infrastructure.Configurations;

/// <summary>
/// Ponto de entrada mestre para registro de todos os módulos de infraestrutura no container de DI.
/// </summary>
public static class InfrastructureExtensions
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        services.AddAppOptions(configuration);
        services.AddDependencyInjection();
        services.AddRedisInfrastructure(configuration);
        services.AddJwtAuthentication(configuration, environment);
        services.AddMessagingInfrastructure(configuration);
        services.AddGateways();
        services.AddCorsConfiguration(configuration);

        return services;
    }
}
