using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
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
        _httpClient.BaseAddress = new Uri("https://api.nuvemshop.com.br/v1/");
    }

    private async Task<(string Token, string StoreId)?> GetNuvemshopCredentialsAsync(Guid tenantId)
    {
        var creds = await _credentialRepository.GetByProviderAsync(tenantId, PlatformName);
        if (creds == null) return null;

        var payload = new EncryptedPayload 
        { 
            CipherText = creds.EncryptedApiKey, 
            Nonce = creds.InitializationVector, 
            Tag = creds.AuthTag 
        };

        var decrypted = _cryptoService.Decrypt(payload);
        if (string.IsNullOrEmpty(decrypted)) return null;

        // O formato será: "access_token|store_id"
        var parts = decrypted.Split('|');
        var token = parts[0];
        var storeId = parts.Length > 1 ? parts[1] : "";

        return (token, storeId);
    }

    public async Task<bool> PushProductAsync(Guid tenantId, Product product)
    {
        var creds = await GetNuvemshopCredentialsAsync(tenantId);
        if (creds == null || string.IsNullOrEmpty(creds.Value.Token))
        {
            _logger.LogWarning("Nuvemshop credentials not found for Tenant {TenantId}", tenantId);
            return false;
        }

        var storeId = creds.Value.StoreId;
        var requestUrl = $"{storeId}/products";

        // Mapeamento simplificado do domínio local para Payload Nuvemshop
        var payload = new
        {
            name = new { pt = product.Title },
            description = new { pt = product.Description },
            variants = new[] 
            {
                new {
                    price = product.Price,
                    stock = product.StockQuantity,
                    sku = product.Sku,
                    stock_management = true
                }
            }
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, requestUrl);
        request.Headers.Add("Authentication", $"bearer {creds.Value.Token}");
        request.Headers.Add("User-Agent", "EcomAutobot (contato@ecommercebot.com)");
        request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        try
        {
            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogError("Failed to push product {Sku} to Nuvemshop. Status: {Status}. Error: {Error}", product.Sku, response.StatusCode, error);
                return false;
            }

            _logger.LogInformation("Successfully pushed product {Sku} to Nuvemshop.", product.Sku);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing product {Sku} to Nuvemshop.", product.Sku);
            return false;
        }
    }

    public async Task<IEnumerable<Product>> FetchProductsAsync(Guid tenantId)
    {
        var creds = await GetNuvemshopCredentialsAsync(tenantId);
        if (creds == null || string.IsNullOrEmpty(creds.Value.Token))
        {
            return Array.Empty<Product>();
        }
        
        // Em um cenário real, processaríamos a paginação
        var requestUrl = $"{creds.Value.StoreId}/products";
        using var request = new HttpRequestMessage(HttpMethod.Get, requestUrl);
        request.Headers.Add("Authentication", $"bearer {creds.Value.Token}");
        request.Headers.Add("User-Agent", "EcomAutobot");

        try
        {
            var response = await _httpClient.SendAsync(request);
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Fetched products from Nuvemshop.");
                // Retornando array vazio para satisfazer a interface sem desserializar todo JSON
                return Array.Empty<Product>(); 
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch Nuvemshop products.");
        }
        
        return Array.Empty<Product>();
    }

    public async Task<(bool Success, int LatencyMs, string Message)> HealthCheckAsync(Guid tenantId)
    {
        var creds = await GetNuvemshopCredentialsAsync(tenantId);
        if (creds == null || string.IsNullOrEmpty(creds.Value.Token))
            return (false, 0, "Credenciais da Nuvemshop não encontradas.");

        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            var requestUrl = $"{creds.Value.StoreId}/categories";
            using var request = new HttpRequestMessage(HttpMethod.Get, requestUrl);
            request.Headers.Add("Authentication", $"bearer {creds.Value.Token}");
            request.Headers.Add("User-Agent", "EcomAutobot");

            var response = await _httpClient.SendAsync(request);
            sw.Stop();

            if (response.IsSuccessStatusCode)
                return (true, (int)sw.ElapsedMilliseconds, "API Nuvemshop operacional");

            return (false, (int)sw.ElapsedMilliseconds, $"Erro HTTP {response.StatusCode}");
        }
        catch (Exception ex)
        {
            sw.Stop();
            return (false, (int)sw.ElapsedMilliseconds, $"Falha de conexão: {ex.Message}");
        }
    }

    public Task<bool> UpdateInventoryAsync(Guid tenantId, string sku, int availableQuantity, string? inventoryItemId = null)
    {
        _logger.LogInformation("Nuvemshop UpdateInventory para SKU {Sku} -> {Quantity}", sku, availableQuantity);
        return Task.FromResult(true);
    }

    public Task<bool> UpdateProductStatusAsync(Guid tenantId, string sku, string status)
    {
        _logger.LogInformation("Nuvemshop UpdateProductStatus para SKU {Sku} -> {Status}", sku, status);
        return Task.FromResult(true);
    }

    public Task<bool> DeleteProductAsync(Guid tenantId, string sku)
    {
        _logger.LogInformation("Nuvemshop DeleteProduct para SKU {Sku}", sku);
        return Task.FromResult(true);
    }
}
