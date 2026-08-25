using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Gateways;

public class NuvemshopGateway : IEcommerceGateway
{
    private readonly HttpClient _httpClient;
    private readonly ITenantAiCredentialRepository _credentialRepository;
    private readonly IAesGcmCryptoService _cryptoService;
    private readonly ILogger<NuvemshopGateway> _logger;

    public string PlatformName => "Nuvemshop";

    public NuvemshopGateway(
        HttpClient httpClient, 
        ITenantAiCredentialRepository credentialRepository,
        IAesGcmCryptoService cryptoService,
        ILogger<NuvemshopGateway> logger)
    {
        _httpClient = httpClient;
        _credentialRepository = credentialRepository;
        _cryptoService = cryptoService;
        _logger = logger;
    }

    private async Task<string?> GetNuvemshopTokenAsync(Guid tenantId)
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
        var token = await GetNuvemshopTokenAsync(tenantId);
        if (string.IsNullOrEmpty(token))
        {
            _logger.LogWarning("Token Nuvemshop não encontrado para Tenant {TenantId}", tenantId);
            return false;
        }

        // Lógica de envio via Nuvemshop REST API (Mock)
        _logger.LogInformation("Enviando produto {Sku} para a Nuvemshop...", product.Sku);
        await Task.Delay(500); 
        
        return true; 
    }

    public async Task<IEnumerable<Product>> FetchProductsAsync(Guid tenantId)
    {
        return Array.Empty<Product>();
    }
}
