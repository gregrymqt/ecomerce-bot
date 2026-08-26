using EcommerceBot.Application.Interfaces;
using EcommerceBot.Infrastructure.Gateways;
using Microsoft.Extensions.DependencyInjection;

namespace EcommerceBot.Infrastructure.Configurations;

/// <summary>
/// Configuração dos Gateways HTTP para e-commerces (Shopify, Nuvemshop) e email (Resend).
/// </summary>
public static class GatewayExtensions
{
    public static IServiceCollection AddGateways(this IServiceCollection services)
    {
        services.AddHttpClient<IEcommerceGateway, ShopifyGateway>();
        services.AddHttpClient<IEcommerceGateway, NuvemshopGateway>();
        services.AddHttpClient<IResendGateway, ResendGateway>();

        return services;
    }
}
