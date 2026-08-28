using EcommerceBot.Application.Interfaces;
using EcommerceBot.Infrastructure.Gateways;
using EcommerceBot.Infrastructure.Services;
using Microsoft.Extensions.DependencyInjection;

namespace EcommerceBot.Infrastructure.Configurations;

/// <summary>
/// Configuração dos Gateways HTTP para e-commerces (Shopify, Nuvemshop), email (Resend) e alertas (Discord).
/// </summary>
public static class GatewayExtensions
{
    public static IServiceCollection AddGateways(this IServiceCollection services)
    {
        services.AddHttpClient<IEcommerceGateway, ShopifyGateway>();
        services.AddHttpClient<IEcommerceGateway, NuvemshopGateway>();
        services.AddHttpClient<IResendGateway, ResendGateway>();
        services.AddHttpClient<IMercadoPagoGateway, MercadoPagoGateway>();
        services.AddHttpClient<IDiscordAlertService, DiscordAlertService>();

        return services;
    }
}
