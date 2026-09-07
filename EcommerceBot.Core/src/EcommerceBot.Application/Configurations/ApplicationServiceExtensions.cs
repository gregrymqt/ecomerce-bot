using Microsoft.Extensions.DependencyInjection;

namespace EcommerceBot.Application.Configurations;

/// <summary>
/// Metodos de extensao para registro de servicos e utilitarios da camada Application no container de DI.
/// </summary>
public static class ApplicationServiceExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        // Ponto de extensao para servicos puros da camada Application, validadores e mediadores
        return services;
    }
}
