using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Nuvemshop;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Gateways;

public class NuvemshopGateway : IEcommerceGateway
{
    private readonly HttpClient _httpClient;
    private readonly IStoreIntegrationRepository _integrationRepository;
    private readonly IAesGcmCryptoService _cryptoService;
    private readonly IProductRepository _productRepository;
    private readonly ILogger<NuvemshopGateway> _logger;

    public string PlatformName => "Nuvemshop";

    public NuvemshopGateway(
        HttpClient httpClient,
        IStoreIntegrationRepository integrationRepository,
        IAesGcmCryptoService cryptoService,
        IProductRepository productRepository,
        ILogger<NuvemshopGateway> logger)
    {
        _httpClient = httpClient;
        _integrationRepository = integrationRepository;
        _cryptoService = cryptoService;
        _productRepository = productRepository;
        _logger = logger;
        _httpClient.BaseAddress = new Uri("https://api.nuvemshop.com.br/v1/");
    }

    private async Task<(string Token, string StoreId)?> GetNuvemshopCredentialsAsync(Guid tenantId)
    {
        var integration = await _integrationRepository.GetByTenantAndPlatformAsync(tenantId, "NUVEMSHOP");
        if (integration == null || integration.EncryptedAccessToken == null || integration.InitializationVector == null || integration.AuthTag == null)
            return null;

        var payload = new EncryptedPayload
        {
            CipherText = integration.EncryptedAccessToken,
            Nonce = integration.InitializationVector,
            Tag = integration.AuthTag
        };

        var decryptedToken = _cryptoService.Decrypt(payload);
        if (string.IsNullOrEmpty(decryptedToken)) return null;

        var storeId = !string.IsNullOrEmpty(integration.StoreDomain) ? integration.StoreDomain : "";
        return (decryptedToken, storeId);
    }

    public async Task<bool> PushProductAsync(Guid tenantId, Product product)
    {
        var creds = await GetNuvemshopCredentialsAsync(tenantId);
        if (creds == null || string.IsNullOrEmpty(creds.Value.Token) || string.IsNullOrEmpty(creds.Value.StoreId))
        {
            _logger.LogWarning("Nuvemshop credentials not found for Tenant {TenantId}", tenantId);
            return false;
        }

        var storeId = creds.Value.StoreId;
        var requestUrl = $"{storeId}/products";

        // Extrai imagens da galeria se existirem
        var imagePayloads = new List<NuvemshopImagePayload>();
        if (!string.IsNullOrEmpty(product.ImagesJson))
        {
            try
            {
                var images = JsonSerializer.Deserialize<List<string>>(product.ImagesJson);
                if (images != null)
                {
                    int pos = 1;
                    foreach (var imgUrl in images.Where(u => !string.IsNullOrWhiteSpace(u)))
                    {
                        imagePayloads.Add(new NuvemshopImagePayload { Src = imgUrl.Trim(), Position = pos++ });
                    }
                }
            }
            catch
            {
                // Fallback para URL única
                if (!string.IsNullOrWhiteSpace(product.ImagesJson) && product.ImagesJson.StartsWith("http"))
                {
                    imagePayloads.Add(new NuvemshopImagePayload { Src = product.ImagesJson.Trim(), Position = 1 });
                }
            }
        }

        var priceStr = product.Price.ToString("F2", CultureInfo.InvariantCulture);
        string? promoPriceStr = null;
        if (product.OriginalPrice.HasValue && product.OriginalPrice.Value > product.Price)
        {
            promoPriceStr = priceStr;
            priceStr = product.OriginalPrice.Value.ToString("F2", CultureInfo.InvariantCulture);
        }

        var payload = new NuvemshopProductPayload
        {
            Name = new Dictionary<string, string> { { "pt", product.Title } },
            Description = new Dictionary<string, string> { { "pt", product.Description ?? product.Title } },
            Brand = product.Brand,
            Published = true,
            Variants = new List<NuvemshopVariantPayload>
            {
                new()
                {
                    Price = priceStr,
                    PromotionalPrice = promoPriceStr,
                    Stock = product.StockQuantity,
                    Sku = product.Sku,
                    StockManagement = true
                }
            },
            Images = imagePayloads.Count > 0 ? imagePayloads : null
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, requestUrl);
        request.Headers.Add("Authentication", $"bearer {creds.Value.Token}");
        request.Headers.Add("User-Agent", "EcomAutobot (contato@ecommercebot.com)");
        request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        try
        {
            var response = await _httpClient.SendAsync(request);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Failed to push product {Sku} to Nuvemshop. Status: {Status}. Error: {Error}", product.Sku, response.StatusCode, responseBody);
                return false;
            }

            var createdProduct = JsonSerializer.Deserialize<NuvemshopProductResponse>(responseBody);
            if (createdProduct != null && createdProduct.Id > 0)
            {
                product.NuvemshopProductId = createdProduct.Id.ToString();
                var firstVariant = createdProduct.Variants?.FirstOrDefault();
                if (firstVariant != null && firstVariant.Id > 0)
                {
                    product.NuvemshopVariantId = firstVariant.Id.ToString();
                }

                await _productRepository.UpdateAsync(product);
                _logger.LogInformation("Successfully pushed product {Sku} to Nuvemshop (Id: {ProductId}, VariantId: {VariantId}).", product.Sku, product.NuvemshopProductId, product.NuvemshopVariantId);
            }

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
        if (creds == null || string.IsNullOrEmpty(creds.Value.Token) || string.IsNullOrEmpty(creds.Value.StoreId))
            return Array.Empty<Product>();

        var requestUrl = $"{creds.Value.StoreId}/products";
        using var request = new HttpRequestMessage(HttpMethod.Get, requestUrl);
        request.Headers.Add("Authentication", $"bearer {creds.Value.Token}");
        request.Headers.Add("User-Agent", "EcomAutobot");

        try
        {
            var response = await _httpClient.SendAsync(request);
            if (response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                var nuvemProducts = JsonSerializer.Deserialize<List<NuvemshopProductResponse>>(body);
                if (nuvemProducts == null) return Array.Empty<Product>();

                return nuvemProducts.Select(np => new Product
                {
                    TenantId = tenantId,
                    NuvemshopProductId = np.Id.ToString(),
                    Title = np.Name?.GetValueOrDefault("pt") ?? "Produto Nuvemshop",
                    Sku = np.Variants?.FirstOrDefault()?.Sku ?? $"NUVEM-{np.Id}",
                    Price = decimal.TryParse(np.Variants?.FirstOrDefault()?.Price, NumberStyles.Any, CultureInfo.InvariantCulture, out var p) ? p : 0m,
                    StockQuantity = np.Variants?.FirstOrDefault()?.Stock ?? 0
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch Nuvemshop products for Tenant {TenantId}", tenantId);
        }

        return Array.Empty<Product>();
    }

    public async Task<(bool Success, int LatencyMs, string Message)> HealthCheckAsync(Guid tenantId)
    {
        var creds = await GetNuvemshopCredentialsAsync(tenantId);
        if (creds == null || string.IsNullOrEmpty(creds.Value.Token) || string.IsNullOrEmpty(creds.Value.StoreId))
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

    public async Task<bool> UpdateInventoryAsync(Guid tenantId, string sku, int availableQuantity, string? inventoryItemId = null)
    {
        var creds = await GetNuvemshopCredentialsAsync(tenantId);
        if (creds == null || string.IsNullOrEmpty(creds.Value.Token)) return false;

        var product = await _productRepository.GetBySkuAsync(tenantId, sku);
        if (product == null || string.IsNullOrEmpty(product.NuvemshopProductId) || string.IsNullOrEmpty(product.NuvemshopVariantId))
        {
            _logger.LogWarning("Nuvemshop variant ID not mapped for SKU {Sku}", sku);
            return false;
        }

        var requestUrl = $"{creds.Value.StoreId}/products/{product.NuvemshopProductId}/variants/{product.NuvemshopVariantId}";
        using var request = new HttpRequestMessage(HttpMethod.Put, requestUrl);
        request.Headers.Add("Authentication", $"bearer {creds.Value.Token}");
        request.Headers.Add("User-Agent", "EcomAutobot");

        var payload = new { stock = availableQuantity };
        request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        var response = await _httpClient.SendAsync(request);
        return response.IsSuccessStatusCode;
    }

    public async Task<bool> UpdateProductStatusAsync(Guid tenantId, string sku, string status)
    {
        var creds = await GetNuvemshopCredentialsAsync(tenantId);
        if (creds == null || string.IsNullOrEmpty(creds.Value.Token)) return false;

        var product = await _productRepository.GetBySkuAsync(tenantId, sku);
        if (product == null || string.IsNullOrEmpty(product.NuvemshopProductId)) return false;

        var requestUrl = $"{creds.Value.StoreId}/products/{product.NuvemshopProductId}";
        using var request = new HttpRequestMessage(HttpMethod.Put, requestUrl);
        request.Headers.Add("Authentication", $"bearer {creds.Value.Token}");
        request.Headers.Add("User-Agent", "EcomAutobot");

        var isPublished = status.Equals("ACTIVE", StringComparison.OrdinalIgnoreCase) || status.Equals("PROCESSED", StringComparison.OrdinalIgnoreCase);
        var payload = new { published = isPublished };
        request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        var response = await _httpClient.SendAsync(request);
        return response.IsSuccessStatusCode;
    }

    public async Task<bool> DeleteProductAsync(Guid tenantId, string sku)
    {
        var creds = await GetNuvemshopCredentialsAsync(tenantId);
        if (creds == null || string.IsNullOrEmpty(creds.Value.Token)) return false;

        var product = await _productRepository.GetBySkuAsync(tenantId, sku);
        if (product == null || string.IsNullOrEmpty(product.NuvemshopProductId)) return false;

        var requestUrl = $"{creds.Value.StoreId}/products/{product.NuvemshopProductId}";
        using var request = new HttpRequestMessage(HttpMethod.Delete, requestUrl);
        request.Headers.Add("Authentication", $"bearer {creds.Value.Token}");
        request.Headers.Add("User-Agent", "EcomAutobot");

        var response = await _httpClient.SendAsync(request);
        return response.IsSuccessStatusCode;
    }
}
