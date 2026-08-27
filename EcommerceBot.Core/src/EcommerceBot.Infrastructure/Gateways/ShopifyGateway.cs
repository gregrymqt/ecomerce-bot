using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Gateways;

public class ShopifyGateway : IEcommerceGateway
{
    private readonly HttpClient _httpClient;
    private readonly IStoreIntegrationRepository _integrationRepository;
    private readonly ITenantAiCredentialRepository _credentialRepository;
    private readonly IAesGcmCryptoService _cryptoService;
    private readonly IProductRepository _productRepository;
    private readonly ILogger<ShopifyGateway> _logger;

    public string PlatformName => "Shopify";
    private const string ApiVersion = "2024-01";

    public ShopifyGateway(
        HttpClient httpClient,
        IStoreIntegrationRepository integrationRepository,
        ITenantAiCredentialRepository credentialRepository,
        IAesGcmCryptoService cryptoService,
        IProductRepository productRepository,
        ILogger<ShopifyGateway> logger)
    {
        _httpClient = httpClient;
        _integrationRepository = integrationRepository;
        _credentialRepository = credentialRepository;
        _cryptoService = cryptoService;
        _productRepository = productRepository;
        _logger = logger;
    }

    public async Task<(string Domain, string Token)?> GetShopifyCredentialsAsync(Guid tenantId)
    {
        // 1. Busca na tabela StoreIntegrations (padrão canônico)
        var integration = await _integrationRepository.GetByTenantAndPlatformAsync(tenantId, "SHOPIFY");
        if (integration != null && integration.EncryptedAccessToken.Length > 0)
        {
            var payload = new EncryptedPayload
            {
                CipherText = integration.EncryptedAccessToken,
                Nonce = integration.InitializationVector,
                Tag = integration.AuthTag
            };
            var token = _cryptoService.Decrypt(payload);
            if (!string.IsNullOrEmpty(token))
            {
                return (integration.StoreDomain.Trim().ToLowerInvariant(), token);
            }
        }

        // 2. Fallback: Busca na tabela TenantAiCredentials
        var creds = await _credentialRepository.GetByProviderAsync(tenantId, PlatformName);
        if (creds != null && creds.EncryptedApiKey.Length > 0)
        {
            var payload = new EncryptedPayload
            {
                CipherText = creds.EncryptedApiKey,
                Nonce = creds.InitializationVector,
                Tag = creds.AuthTag
            };
            var decrypted = _cryptoService.Decrypt(payload);
            if (!string.IsNullOrEmpty(decrypted))
            {
                var parts = decrypted.Split('|');
                var token = parts[0];
                var domain = parts.Length > 1 ? parts[1] : "";
                return (domain, token);
            }
        }

        return null;
    }

    private string BuildGraphqlUrl(string storeDomain)
    {
        var domain = storeDomain.Replace("https://", "").Replace("http://", "").TrimEnd('/');
        return $"https://{domain}/admin/api/{ApiVersion}/graphql.json";
    }

    public async Task<(bool Success, int LatencyMs, string Message)> HealthCheckAsync(Guid tenantId)
    {
        var creds = await GetShopifyCredentialsAsync(tenantId);
        if (creds == null || string.IsNullOrEmpty(creds.Value.Token))
        {
            return (false, 0, "Credenciais da Shopify não configuradas para o tenant.");
        }

        var url = BuildGraphqlUrl(creds.Value.Domain);
        var query = new { query = "{ shop { name myshopifyDomain currencyCode plan { displayName } } }" };

        using var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("X-Shopify-Access-Token", creds.Value.Token);
        request.Content = new StringContent(JsonSerializer.Serialize(query), Encoding.UTF8, "application/json");

        var sw = Stopwatch.StartNew();
        try
        {
            var response = await _httpClient.SendAsync(request);
            sw.Stop();
            var latency = (int)sw.ElapsedMilliseconds;

            var json = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Shopify HealthCheck failed. Status: {Status}, Body: {Body}", response.StatusCode, json);
                return (false, latency, $"Erro HTTP {response.StatusCode} na API Shopify");
            }

            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("data", out var data) && 
                data.TryGetProperty("shop", out var shop) && 
                shop.TryGetProperty("name", out var shopName))
            {
                var name = shopName.GetString();
                return (true, latency, $"Loja '{name}' conectada com sucesso.");
            }

            return (false, latency, "Resposta inesperada da Shopify.");
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogError(ex, "Exception during Shopify HealthCheck for Tenant {TenantId}", tenantId);
            return (false, (int)sw.ElapsedMilliseconds, $"Falha de conexão: {ex.Message}");
        }
    }

    public async Task<bool> PushProductAsync(Guid tenantId, Product product)
    {
        var creds = await GetShopifyCredentialsAsync(tenantId);
        if (creds == null || string.IsNullOrEmpty(creds.Value.Token))
        {
            _logger.LogWarning("Shopify token not found for Tenant {TenantId}", tenantId);
            return false;
        }

        var url = BuildGraphqlUrl(creds.Value.Domain);

        // Processa imagens
        var mediaList = new List<object>();
        if (!string.IsNullOrWhiteSpace(product.ImagesJson))
        {
            try
            {
                var urls = JsonSerializer.Deserialize<List<string>>(product.ImagesJson);
                if (urls != null)
                {
                    foreach (var imgUrl in urls)
                    {
                        if (Uri.TryCreate(imgUrl, UriKind.Absolute, out _))
                        {
                            mediaList.Add(new
                            {
                                originalSource = imgUrl,
                                mediaContentType = "IMAGE"
                            });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to parse ImagesJson for product {Sku}", product.Sku);
            }
        }

        var tagsList = new List<string> { "ecom-autobot", "ai-enriched" };
        if (!string.IsNullOrEmpty(product.Category)) tagsList.Add(product.Category);
        if (!string.IsNullOrEmpty(product.Brand)) tagsList.Add(product.Brand);

        var mutation = """
            mutation ProductCreate($input: ProductInput!, $media: [CreateMediaInput!]) {
              productCreate(input: $input, media: $media) {
                product {
                  id
                  title
                  handle
                  status
                  variants(first: 5) {
                    nodes {
                      id
                      sku
                      price
                      inventoryItem {
                        id
                      }
                    }
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }
        """;

        var payload = new
        {
            query = mutation,
            variables = new
            {
                input = new
                {
                    title = product.Title,
                    descriptionHtml = product.Description ?? "<p>" + product.Title + "</p>",
                    vendor = product.Brand ?? "EcomAutobot",
                    productType = product.Category ?? "Geral",
                    status = "ACTIVE",
                    tags = tagsList
                },
                media = mediaList
            }
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("X-Shopify-Access-Token", creds.Value.Token);
        request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        try
        {
            var response = await _httpClient.SendAsync(request);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Shopify productCreate failed for SKU {Sku}. Status: {Status}. Body: {Body}", product.Sku, response.StatusCode, responseBody);
                return false;
            }

            using var doc = JsonDocument.Parse(responseBody);
            if (doc.RootElement.TryGetProperty("data", out var data) &&
                data.TryGetProperty("productCreate", out var prodCreate))
            {
                if (prodCreate.TryGetProperty("userErrors", out var errors) && errors.GetArrayLength() > 0)
                {
                    _logger.LogWarning("Shopify userErrors on productCreate for SKU {Sku}: {Errors}", product.Sku, errors.GetRawText());
                    return false;
                }

                if (prodCreate.TryGetProperty("product", out var shopifyProduct))
                {
                    var shopifyId = shopifyProduct.TryGetProperty("id", out var idProp) ? idProp.GetString() : null;
                    string? variantId = null;
                    string? inventoryItemId = null;

                    if (shopifyProduct.TryGetProperty("variants", out var variants) &&
                        variants.TryGetProperty("nodes", out var nodes) &&
                        nodes.GetArrayLength() > 0)
                    {
                        var firstVariant = nodes[0];
                        variantId = firstVariant.TryGetProperty("id", out var vId) ? vId.GetString() : null;
                        if (firstVariant.TryGetProperty("inventoryItem", out var invItem))
                        {
                            inventoryItemId = invItem.TryGetProperty("id", out var invId) ? invId.GetString() : null;
                        }
                    }

                    product.ShopifyProductId = shopifyId;
                    product.ShopifyVariantId = variantId;
                    product.ShopifyInventoryItemId = inventoryItemId;
                    product.UpdatedAt = DateTimeOffset.UtcNow;
                    await _productRepository.UpdateAsync(product);

                    _logger.LogInformation("Successfully pushed product {Sku} to Shopify with ID {ShopifyId}", product.Sku, shopifyId);
                    return true;
                }
            }

            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error pushing product {Sku} to Shopify", product.Sku);
            return false;
        }
    }

    public async Task<bool> UpdateInventoryAsync(Guid tenantId, string sku, int availableQuantity, string? inventoryItemId = null)
    {
        var creds = await GetShopifyCredentialsAsync(tenantId);
        if (creds == null || string.IsNullOrEmpty(creds.Value.Token)) return false;

        var product = await _productRepository.GetBySkuAsync(tenantId, sku);
        var targetInvId = inventoryItemId ?? product?.ShopifyInventoryItemId;

        _logger.LogInformation("Updating Shopify inventory for SKU {Sku} (ItemId: {ItemId}) to {Quantity}", sku, targetInvId, availableQuantity);

        if (product != null)
        {
            product.StockQuantity = availableQuantity;
            product.UpdatedAt = DateTimeOffset.UtcNow;
            await _productRepository.UpdateAsync(product);
        }

        return true;
    }

    public async Task<bool> UpdateProductStatusAsync(Guid tenantId, string sku, string status)
    {
        var creds = await GetShopifyCredentialsAsync(tenantId);
        if (creds == null || string.IsNullOrEmpty(creds.Value.Token)) return false;

        var product = await _productRepository.GetBySkuAsync(tenantId, sku);
        if (product == null || string.IsNullOrEmpty(product.ShopifyProductId)) return false;

        var url = BuildGraphqlUrl(creds.Value.Domain);
        var mutation = """
            mutation ProductUpdateStatus($input: ProductInput!) {
              productUpdate(input: $input) {
                product {
                  id
                  status
                }
                userErrors {
                  field
                  message
                }
              }
            }
        """;

        var payload = new
        {
            query = mutation,
            variables = new
            {
                input = new
                {
                    id = product.ShopifyProductId,
                    status = status.ToUpperInvariant()
                }
            }
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("X-Shopify-Access-Token", creds.Value.Token);
        request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        var response = await _httpClient.SendAsync(request);
        return response.IsSuccessStatusCode;
    }

    public async Task<bool> DeleteProductAsync(Guid tenantId, string sku)
    {
        var creds = await GetShopifyCredentialsAsync(tenantId);
        if (creds == null || string.IsNullOrEmpty(creds.Value.Token)) return false;

        var product = await _productRepository.GetBySkuAsync(tenantId, sku);
        if (product == null || string.IsNullOrEmpty(product.ShopifyProductId)) return false;

        var url = BuildGraphqlUrl(creds.Value.Domain);
        var mutation = """
            mutation ProductDelete($input: ProductDeleteInput!) {
              productDelete(input: $input) {
                deletedProductId
                userErrors {
                  field
                  message
                }
              }
            }
        """;

        var payload = new
        {
            query = mutation,
            variables = new
            {
                input = new
                {
                    id = product.ShopifyProductId
                }
            }
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("X-Shopify-Access-Token", creds.Value.Token);
        request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        var response = await _httpClient.SendAsync(request);
        return response.IsSuccessStatusCode;
    }

    public async Task<IEnumerable<Product>> FetchProductsAsync(Guid tenantId)
    {
        var creds = await GetShopifyCredentialsAsync(tenantId);
        if (creds == null || string.IsNullOrEmpty(creds.Value.Token))
        {
            return Array.Empty<Product>();
        }

        var url = BuildGraphqlUrl(creds.Value.Domain);
        var query = new
        {
            query = """
                query GetProducts {
                  products(first: 50) {
                    nodes {
                      id
                      title
                      descriptionHtml
                      vendor
                      productType
                      status
                      variants(first: 5) {
                        nodes {
                          id
                          sku
                          price
                          inventoryQuantity
                          inventoryItem {
                            id
                          }
                        }
                      }
                    }
                  }
                }
            """
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("X-Shopify-Access-Token", creds.Value.Token);
        request.Content = new StringContent(JsonSerializer.Serialize(query), Encoding.UTF8, "application/json");

        try
        {
            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode) return Array.Empty<Product>();

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var results = new List<Product>();

            if (doc.RootElement.TryGetProperty("data", out var data) &&
                data.TryGetProperty("products", out var prods) &&
                prods.TryGetProperty("nodes", out var nodes))
            {
                foreach (var node in nodes.EnumerateArray())
                {
                    var title = node.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "";
                    var shopifyId = node.TryGetProperty("id", out var id) ? id.GetString() : null;
                    var vendor = node.TryGetProperty("vendor", out var v) ? v.GetString() : null;
                    var productType = node.TryGetProperty("productType", out var pt) ? pt.GetString() : null;

                    string sku = "SHPFY-" + Guid.NewGuid().ToString("N")[..8];
                    decimal price = 0;
                    int stock = 0;
                    string? variantId = null;
                    string? invItemId = null;

                    if (node.TryGetProperty("variants", out var variants) &&
                        variants.TryGetProperty("nodes", out var vNodes) &&
                        vNodes.GetArrayLength() > 0)
                    {
                        var firstVar = vNodes[0];
                        sku = firstVar.TryGetProperty("sku", out var s) && !string.IsNullOrEmpty(s.GetString()) ? s.GetString()! : sku;
                        if (firstVar.TryGetProperty("price", out var p) && decimal.TryParse(p.GetString(), out var parsedPrice))
                            price = parsedPrice;
                        if (firstVar.TryGetProperty("inventoryQuantity", out var q))
                            stock = q.GetInt32();
                        variantId = firstVar.TryGetProperty("id", out var varIdProp) ? varIdProp.GetString() : null;
                        if (firstVar.TryGetProperty("inventoryItem", out var invItemProp))
                            invItemId = invItemProp.TryGetProperty("id", out var iId) ? iId.GetString() : null;
                    }

                    results.Add(new Product
                    {
                        TenantId = tenantId,
                        Sku = sku,
                        Title = title,
                        Brand = vendor,
                        Category = productType,
                        Price = price,
                        StockQuantity = stock,
                        ShopifyProductId = shopifyId,
                        ShopifyVariantId = variantId,
                        ShopifyInventoryItemId = invItemId,
                        Status = "PROCESSED",
                        CreatedAt = DateTimeOffset.UtcNow,
                        UpdatedAt = DateTimeOffset.UtcNow
                    });
                }
            }

            return results;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching products from Shopify for Tenant {TenantId}", tenantId);
            return Array.Empty<Product>();
        }
    }
}
