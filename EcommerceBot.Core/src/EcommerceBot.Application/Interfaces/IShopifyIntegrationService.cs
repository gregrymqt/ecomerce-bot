using System;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Integrations;
using EcommerceBot.Application.DTOs.Shopify;

namespace EcommerceBot.Application.Interfaces;

public interface IShopifyIntegrationService
{
    Task<StoreIntegrationResponseDto> SaveCredentialsAsync(Guid tenantId, ShopifyCredentialsPayloadDto payload);
    Task<string> GetOAuthUrlAsync(Guid tenantId, string shopDomain);
    Task HandleOAuthCallbackAsync(Guid tenantId, string code, string shopDomain);
    Task<ShopifyProductResponseDto> SyncProductAsync(Guid tenantId, ShopifySyncRequestDto request);
    Task<ShopifyBulkSyncResponseDto> TriggerBulkSyncAsync(Guid tenantId, ShopifyBulkSyncRequestDto request);
    Task<ShopifyProductResponseDto> UpdateInventoryAsync(Guid tenantId, string sku, ShopifyInventoryUpdateDto input);
    Task<ShopifyProductResponseDto> UpdateStatusAsync(Guid tenantId, string sku, ShopifyStatusUpdateDto input);
    Task<ShopifyProductResponseDto> DeleteRemoteProductAsync(Guid tenantId, string sku);
    Task ProcessWebhookAsync(Guid tenantId, string topic, string shopDomain, JsonElement payload);
}
