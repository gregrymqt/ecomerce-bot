using System;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

public class ShopifyIntegrationService : IShopifyIntegrationService
{
    private readonly IProductRepository _productRepository;
    private readonly ITenantAiCredentialRepository _credentialRepository;
    private readonly ILogger<ShopifyIntegrationService> _logger;

    public ShopifyIntegrationService(
        IProductRepository productRepository,
        ITenantAiCredentialRepository credentialRepository,
        ILogger<ShopifyIntegrationService> logger)
    {
        _productRepository = productRepository;
        _credentialRepository = credentialRepository;
        _logger = logger;
    }

    public async Task ProcessWebhookAsync(Guid tenantId, string topic, string shopDomain, JsonElement payload)
    {
        _logger.LogInformation("Processing Shopify webhook '{Topic}' for '{ShopDomain}' (Tenant: {TenantId})", topic, shopDomain, tenantId);

        if (topic.Equals("products/create", StringComparison.OrdinalIgnoreCase) || 
            topic.Equals("products/update", StringComparison.OrdinalIgnoreCase))
        {
            // Extrai o ID e o Titulo
            var shopifyId = payload.TryGetProperty("id", out var idProp) ? idProp.GetRawText() : "";
            var title = payload.TryGetProperty("title", out var titleProp) ? titleProp.GetString() : "";
            
            // Simula iteração nas Variants
            if (payload.TryGetProperty("variants", out var variants) && variants.ValueKind == JsonValueKind.Array)
            {
                foreach (var variant in variants.EnumerateArray())
                {
                    var sku = variant.TryGetProperty("sku", out var skuProp) ? skuProp.GetString() : null;
                    if (!string.IsNullOrEmpty(sku))
                    {
                        _logger.LogInformation("Syncing Shopify SKU '{Sku}' into C# ProductRepository", sku);
                        
                        var product = await _productRepository.GetBySkuAsync(tenantId, sku);
                        if (product != null)
                        {
                            product.Title = title ?? product.Title;
                            product.UpdatedAt = DateTimeOffset.UtcNow;
                            await _productRepository.UpdateAsync(product);
                        }
                    }
                }
            }
        }
        else if (topic.Equals("products/delete", StringComparison.OrdinalIgnoreCase))
        {
            var shopifyId = payload.TryGetProperty("id", out var idProp) ? idProp.GetRawText() : "";
            _logger.LogInformation("Deleted product ID '{ShopifyId}' from Shopify.", shopifyId);
            // Delete logic would go here
        }
        else if (topic.StartsWith("inventory_levels", StringComparison.OrdinalIgnoreCase))
        {
            var inventoryId = payload.TryGetProperty("inventory_item_id", out var idProp) ? idProp.GetRawText() : "";
            var available = payload.TryGetProperty("available", out var avProp) ? avProp.GetInt32() : 0;
            _logger.LogInformation("Inventory update for item '{InventoryId}' -> {Available}", inventoryId, available);
        }
        else if (topic.StartsWith("app/uninstalled", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Shopify App uninstalled for domain '{ShopDomain}'. Tenant '{TenantId}'.", shopDomain, tenantId);
        }
    }

    public async Task HandleOAuthCallbackAsync(Guid tenantId, string code, string shopDomain)
    {
        _logger.LogInformation("Handling OAuth Callback for Shopify domain '{ShopDomain}' and Tenant '{TenantId}'", shopDomain, tenantId);
        // Exemplo: trocar o auth code por access token via HTTP e guardar no banco via AesGcmCryptoService
        await Task.Delay(100); 
    }
}
