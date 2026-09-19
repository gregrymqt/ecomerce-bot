using System;
using System.Net;
using System.Net.Http;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Application.Interfaces.Gateways;
using EcommerceBot.Application.Interfaces.Services;
using EcommerceBot.Infrastructure.Gateways;
using EcommerceBot.Infrastructure.Options;
using EcommerceBot.Infrastructure.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Polly;
using Polly.Extensions.Http;

namespace EcommerceBot.Infrastructure.Configurations;

/// <summary>
/// Configuração dos Gateways HTTP para e-commerces (Shopify, Nuvemshop), email (Resend), alertas (Discord) e IA (OpenRouter).
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

        // Cliente HTTP de baixo nível para OpenRouter com resiliência Polly
        services.AddHttpClient<IOpenRouterClient, OpenRouterClient>((serviceProvider, client) =>
        {
            var options = serviceProvider.GetRequiredService<IOptions<OpenRouterOptions>>().Value;
            var baseUrl = string.IsNullOrWhiteSpace(options.BaseUrl)
                ? "https://openrouter.ai/api/v1"
                : options.BaseUrl.TrimEnd('/');

            client.BaseAddress = new Uri(baseUrl + "/");
            client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds > 0 ? options.TimeoutSeconds : 60);
        })
        .AddPolicyHandler(GetRetryPolicy())
        .AddPolicyHandler(GetCircuitBreakerPolicy());

        // Serviços de aplicação especializados e orquestrador de alto nível
        services.AddScoped<IProductEnrichmentPromptService, ProductEnrichmentPromptService>();
        services.AddScoped<ILlmContentParserService, LlmContentParserService>();
        services.AddScoped<IOpenRouterGateway, OpenRouterGateway>();

        return services;
    }

    private static IAsyncPolicy<HttpResponseMessage> GetRetryPolicy()
    {
        return HttpPolicyExtensions
            .HandleTransientHttpError()
            .OrResult(msg => msg.StatusCode == HttpStatusCode.TooManyRequests)
            .WaitAndRetryAsync(
                3,
                retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt))
                                + TimeSpan.FromMilliseconds(Random.Shared.Next(0, 500)));
    }

    private static IAsyncPolicy<HttpResponseMessage> GetCircuitBreakerPolicy()
    {
        return HttpPolicyExtensions
            .HandleTransientHttpError()
            .OrResult(msg => msg.StatusCode == HttpStatusCode.TooManyRequests)
            .CircuitBreakerAsync(5, TimeSpan.FromSeconds(30));
    }
}
