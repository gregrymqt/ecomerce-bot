using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Integrations;
using EcommerceBot.Application.DTOs.Shopify;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using MassTransit;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

public class ShopifyIntegrationService : IShopifyIntegrationService
{
    private readonly IStoreIntegrationRepository _storeIntegrationRepository;
    private readonly IProductRepository _productRepository;
    private readonly IAesGcmCryptoService _cryptoService;
    private readonly IEcommerceGatewayFactory _gatewayFactory;
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly HttpClient _httpClient;
    private readonly ILogger<ShopifyIntegrationService> _logger;
    private readonly string _clientId;
    private readonly string _clientSecret;
    private readonly string _appUrl;

    public ShopifyIntegrationService(
        IStoreIntegrationRepository storeIntegrationRepository,
        IProductRepository productRepository,
        IAesGcmCryptoService cryptoService,
        IEcommerceGatewayFactory gatewayFactory,
        IPublishEndpoint publishEndpoint,
        HttpClient httpClient,
        IConfiguration config,
        ILogger<ShopifyIntegrationService> logger)
    {
        _storeIntegrationRepository = storeIntegrationRepository;
        _productRepository = productRepository;
        _cryptoService = cryptoService;
        _gatewayFactory = gatewayFactory;
        _publishEndpoint = publishEndpoint;
        _httpClient = httpClient;
        _logger = logger;
        _clientId = config["Shopify:ClientId"] ?? string.Empty;
        _clientSecret = config["Shopify:ClientSecret"] ?? string.Empty;
        _appUrl = config["App:BaseUrl"] ?? "https://app.ecommercesaas.com";
    }

    public async Task<StoreIntegrationResponseDto> SaveCredentialsAsync(Guid tenantId, ShopifyCredentialsPayloadDto payload)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("TenantId é obrigatório.");
        if (string.IsNullOrWhiteSpace(payload.StoreDomain)) throw new ArgumentException("Domínio da loja é obrigatório.");
        if (string.IsNullOrWhiteSpace(payload.AdminAccessToken)) throw new ArgumentException("Admin Access Token é obrigatório.");

        var cleanDomain = payload.StoreDomain.Replace("https://", "").Replace("http://", "").Trim().TrimEnd('/').ToLowerInvariant();
        var cleanToken = payload.AdminAccessToken.Trim();

        // 1. Criptografia AES-256 GCM do token
        var encrypted = _cryptoService.Encrypt(cleanToken);

        var integration = new StoreIntegration
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Platform = "SHOPIFY",
            StoreDomain = cleanDomain,
            EncryptedAccessToken = encrypted.CipherText,
            InitializationVector = encrypted.Nonce,
            AuthTag = encrypted.Tag,
            Status = "CONNECTED",
            HealthCheckStatus = "Conexão em validação...",
            HealthCheckLatencyMs = 0,
            LastHealthCheckAt = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        await _storeIntegrationRepository.UpsertAsync(integration);

        // 2. Realiza Health Check imediato para testar o token
        try
        {
            var gateway = _gatewayFactory.GetGateway("Shopify");
            var (success, latencyMs, message) = await gateway.HealthCheckAsync(tenantId);
            var status = success ? "CONNECTED" : "ERROR";
            await _storeIntegrationRepository.UpdateHealthCheckAsync(integration.Id, status, latencyMs, message);
            integration.Status = status;
            integration.HealthCheckStatus = message;
            integration.HealthCheckLatencyMs = latencyMs;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro no HealthCheck inicial ao salvar credenciais Shopify.");
        }

        return new StoreIntegrationResponseDto
        {
            Id = integration.Id,
            TenantId = integration.TenantId,
            Platform = integration.Platform,
            StoreDomain = integration.StoreDomain,
            Status = integration.Status,
            HealthCheckStatus = integration.HealthCheckStatus,
            HealthCheckLatencyMs = integration.HealthCheckLatencyMs,
            CreatedAt = integration.CreatedAt
        };
    }

    public Task<string> GetOAuthUrlAsync(Guid tenantId, string shopDomain)
    {
        var cleanShop = shopDomain.Replace("https://", "").Replace("http://", "").Trim().TrimEnd('/').ToLowerInvariant();
        var scopes = "write_products,read_products,write_inventory,read_inventory,write_orders,read_orders";
        var redirectUri = Uri.EscapeDataString($"{_appUrl}/api/v1/shopify/oauth/callback");
        var state = tenantId.ToString("D");

        var authorizeUrl = $"https://{cleanShop}/admin/oauth/authorize?client_id={_clientId}&scope={scopes}&redirect_uri={redirectUri}&state={state}";
        return Task.FromResult(authorizeUrl);
    }

    public async Task HandleOAuthCallbackAsync(Guid tenantId, string code, string shopDomain)
    {
        var cleanShop = shopDomain.Replace("https://", "").Replace("http://", "").Trim().TrimEnd('/').ToLowerInvariant();
        _logger.LogInformation("Exchanging OAuth code for Shopify access token. Shop: {Shop}, Tenant: {TenantId}", cleanShop, tenantId);

        var tokenEndpoint = $"https://{cleanShop}/admin/oauth/access_token";
        var requestBody = new
        {
            client_id = _clientId,
            client_secret = _clientSecret,
            code = code
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, tokenEndpoint)
        {
            Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json")
        };

        var response = await _httpClient.SendAsync(request);
        var json = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Failed to exchange OAuth code with Shopify. Status: {Status}, Error: {Error}", response.StatusCode, json);
            throw new InvalidOperationException($"Falha ao obter token OAuth da Shopify: {response.StatusCode}");
        }

        using var doc = JsonDocument.Parse(json);
        if (doc.RootElement.TryGetProperty("access_token", out var tokenProp))
        {
            var accessToken = tokenProp.GetString();
            if (!string.IsNullOrEmpty(accessToken))
            {
                await SaveCredentialsAsync(tenantId, new ShopifyCredentialsPayloadDto
                {
                    StoreDomain = cleanShop,
                    AdminAccessToken = accessToken
                });
                _logger.LogInformation("Successfully saved Shopify OAuth token for Tenant {TenantId}", tenantId);
            }
        }
    }

    public async Task<ShopifyProductResponseDto> SyncProductAsync(Guid tenantId, ShopifySyncRequestDto request)
    {
        var product = await _productRepository.GetBySkuAsync(tenantId, request.Sku);
        if (product == null)
        {
            product = new Product
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Sku = request.Sku,
                Title = request.Title,
                Description = request.Description,
                Price = request.Price ?? 0,
                Brand = request.Vendor,
                Category = request.Tags,
                ImagesJson = request.Images != null ? JsonSerializer.Serialize(request.Images) : null,
                Status = "PROCESSING",
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            await _productRepository.AddAsync(product);
        }
        else
        {
            product.Title = !string.IsNullOrEmpty(request.Title) ? request.Title : product.Title;
            product.Description = request.Description ?? product.Description;
            if (request.Price.HasValue) product.Price = request.Price.Value;
            if (request.Images != null) product.ImagesJson = JsonSerializer.Serialize(request.Images);
            await _productRepository.UpdateAsync(product);
        }

        var gateway = _gatewayFactory.GetGateway("Shopify");
        var success = await gateway.PushProductAsync(tenantId, product);

        if (success)
        {
            var updated = await _productRepository.GetBySkuAsync(tenantId, request.Sku);
            return new ShopifyProductResponseDto
            {
                ShopifyId = updated?.ShopifyProductId,
                Status = "success",
                Message = "Produto sincronizado com sucesso na Shopify."
            };
        }

        return new ShopifyProductResponseDto
        {
            Status = "error",
            Message = "Falha ao publicar produto na Shopify. Verifique os logs e credenciais.",
            Errors = new List<string> { "GraphQL mutation rejected or token invalid" }
        };
    }

    public async Task<ShopifyBulkSyncResponseDto> TriggerBulkSyncAsync(Guid tenantId, ShopifyBulkSyncRequestDto request)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("X-Tenant-ID header é obrigatório.");
        if (request.Skus == null || request.Skus.Count == 0) throw new ArgumentException("Lista de SKUs não pode estar vazia.");

        var jobId = Guid.NewGuid().ToString("N");

        foreach (var sku in request.Skus)
        {
            var msg = new ShopifyBulkSyncMessage
            {
                JobId = jobId,
                TenantId = tenantId,
                Sku = sku,
                ForceUpdate = true
            };

            await _publishEndpoint.Publish(msg, context =>
            {
                context.SetRoutingKey("shopify_bulk_sync");
            });
        }

        _logger.LogInformation("Enqueued {Count} products for Shopify bulk sync. JobId: {JobId}, Tenant: {TenantId}", request.Skus.Count, jobId, tenantId);

        return new ShopifyBulkSyncResponseDto
        {
            JobId = jobId,
            TotalEnqueued = request.Skus.Count,
            Status = "queued",
            Message = $"Sincronização de {request.Skus.Count} produtos enfileirada com sucesso."
        };
    }

    public async Task<ShopifyProductResponseDto> UpdateInventoryAsync(Guid tenantId, string sku, ShopifyInventoryUpdateDto input)
    {
        var gateway = _gatewayFactory.GetGateway("Shopify");
        var success = await gateway.UpdateInventoryAsync(tenantId, sku, input.AvailableQuantity, input.InventoryItemId);

        return new ShopifyProductResponseDto
        {
            Status = success ? "success" : "error",
            Message = success ? "Estoque atualizado com sucesso na Shopify." : "Falha ao atualizar estoque na Shopify."
        };
    }

    public async Task<ShopifyProductResponseDto> UpdateStatusAsync(Guid tenantId, string sku, ShopifyStatusUpdateDto input)
    {
        var gateway = _gatewayFactory.GetGateway("Shopify");
        var success = await gateway.UpdateProductStatusAsync(tenantId, sku, input.Status);

        return new ShopifyProductResponseDto
        {
            Status = success ? "success" : "error",
            Message = success ? $"Status alterado para '{input.Status}' na Shopify." : "Falha ao alterar status na Shopify."
        };
    }

    public async Task<ShopifyProductResponseDto> DeleteRemoteProductAsync(Guid tenantId, string sku)
    {
        var gateway = _gatewayFactory.GetGateway("Shopify");
        var success = await gateway.DeleteProductAsync(tenantId, sku);

        return new ShopifyProductResponseDto
        {
            Status = success ? "success" : "error",
            Message = success ? "Produto removido com sucesso na Shopify." : "Falha ao remover produto na Shopify."
        };
    }

    public async Task ProcessWebhookAsync(Guid tenantId, string topic, string shopDomain, JsonElement payload)
    {
        _logger.LogInformation("Processing Shopify webhook '{Topic}' for domain '{ShopDomain}', Tenant '{TenantId}'", topic, shopDomain, tenantId);

        if (topic.Equals("products/create", StringComparison.OrdinalIgnoreCase) || 
            topic.Equals("products/update", StringComparison.OrdinalIgnoreCase))
        {
            var shopifyId = payload.TryGetProperty("id", out var idProp) ? idProp.GetRawText() : "";
            var title = payload.TryGetProperty("title", out var titleProp) ? titleProp.GetString() ?? "" : "";
            var bodyHtml = payload.TryGetProperty("body_html", out var descProp) ? descProp.GetString() : null;
            var vendor = payload.TryGetProperty("vendor", out var vendorProp) ? vendorProp.GetString() : null;
            var productType = payload.TryGetProperty("product_type", out var typeProp) ? typeProp.GetString() : null;

            if (payload.TryGetProperty("variants", out var variants) && variants.ValueKind == JsonValueKind.Array)
            {
                foreach (var variant in variants.EnumerateArray())
                {
                    var sku = variant.TryGetProperty("sku", out var skuProp) ? skuProp.GetString() : null;
                    if (string.IsNullOrEmpty(sku))
                    {
                        sku = $"SHPFY-{shopifyId}";
                    }

                    var price = variant.TryGetProperty("price", out var pProp) && decimal.TryParse(pProp.GetString(), out var pVal) ? pVal : 0m;
                    var stock = variant.TryGetProperty("inventory_quantity", out var qProp) ? qProp.GetInt32() : 0;
                    var variantId = variant.TryGetProperty("id", out var vIdProp) ? vIdProp.GetRawText() : null;
                    var invItemId = variant.TryGetProperty("inventory_item_id", out var invProp) ? invProp.GetRawText() : null;

                    var product = await _productRepository.GetBySkuAsync(tenantId, sku);
                    if (product != null)
                    {
                        product.Title = !string.IsNullOrEmpty(title) ? title : product.Title;
                        product.Description = bodyHtml ?? product.Description;
                        product.Price = price > 0 ? price : product.Price;
                        product.StockQuantity = stock;
                        product.ShopifyProductId = shopifyId;
                        product.ShopifyVariantId = variantId;
                        product.ShopifyInventoryItemId = invItemId;
                        product.UpdatedAt = DateTimeOffset.UtcNow;
                        await _productRepository.UpdateAsync(product);
                    }
                    else
                    {
                        var newProd = new Product
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            Sku = sku,
                            Title = title,
                            Description = bodyHtml,
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
                        };
                        await _productRepository.AddAsync(newProd);
                    }
                }
            }
        }
        else if (topic.Equals("products/delete", StringComparison.OrdinalIgnoreCase))
        {
            var shopifyId = payload.TryGetProperty("id", out var idProp) ? idProp.GetRawText() : "";
            _logger.LogInformation("Deleted product ID '{ShopifyId}' from Shopify webhook", shopifyId);
        }
        else if (topic.StartsWith("inventory_levels", StringComparison.OrdinalIgnoreCase))
        {
            var inventoryId = payload.TryGetProperty("inventory_item_id", out var idProp) ? idProp.GetRawText() : "";
            var available = payload.TryGetProperty("available", out var avProp) ? avProp.GetInt32() : 0;
            _logger.LogInformation("Shopify inventory update for item '{InventoryId}' -> {Available}", inventoryId, available);
        }
        else if (topic.StartsWith("app/uninstalled", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Shopify App uninstalled for domain '{ShopDomain}'. Marking integration as DISCONNECTED.", shopDomain);
            var integration = await _storeIntegrationRepository.GetByDomainAsync("SHOPIFY", shopDomain);
            if (integration != null)
            {
                await _storeIntegrationRepository.UpdateHealthCheckAsync(integration.Id, "DISCONNECTED", 0, "App desinstalado na Shopify");
            }
        }
    }
}
