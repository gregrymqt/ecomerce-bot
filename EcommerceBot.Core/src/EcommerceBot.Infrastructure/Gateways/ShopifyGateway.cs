using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Gateways;

public class ShopifyGateway : IEcommerceGateway
{
    private readonly HttpClient _httpClient;
    private readonly ITenantAiCredentialRepository _credentialRepository;
    private readonly IAesGcmCryptoService _cryptoService;
    private readonly ILogger<ShopifyGateway> _logger;

    public string PlatformName => "Shopify";

    public ShopifyGateway(
        HttpClient httpClient, 
        ITenantAiCredentialRepository credentialRepository,
        IAesGcmCryptoService cryptoService,
        ILogger<ShopifyGateway> logger)
    {
        _httpClient = httpClient;
        _credentialRepository = credentialRepository;
        _cryptoService = cryptoService;
        _logger = logger;
    }

    private async Task<string?> GetShopifyTokenAsync(Guid tenantId)
    {
        var creds = await _credentialRepository.GetByProviderAsync(tenantId, PlatformName);
        if (creds == null) return null;

        var payload = new EncryptedPayload 
        { 
            CipherText = creds.EncryptedApiKey, 
            Nonce = creds.InitializationVector, 
            Tag = creds.AuthTag 
        };

        return _cryptoService.Decrypt(payload);
    }

    public async Task<bool> PushProductAsync(Guid tenantId, Product product)
    {
        var token = await GetShopifyTokenAsync(tenantId);
        if (string.IsNullOrEmpty(token))
        {
            _logger.LogWarning("Token Shopify não encontrado para Tenant {TenantId}", tenantId);
            return false;
        }

        // Lógica de envio via GraphQL / Admin API (Mock)
        _logger.LogInformation("Enviando produto {Sku} para a Shopify...", product.Sku);
        await Task.Delay(500); // Simulando delay de rede HTTP
        
        return true; 
    }

    public async Task<IEnumerable<Product>> FetchProductsAsync(Guid tenantId)
    {
        // Simulando listagem de produtos da Shopify
        return [];
    }
}
