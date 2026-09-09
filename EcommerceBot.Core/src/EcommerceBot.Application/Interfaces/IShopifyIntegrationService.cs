using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Integrations;
using EcommerceBot.Application.DTOs.Shopify;

namespace EcommerceBot.Application.Interfaces;

public interface IShopifyIntegrationService
{
    Task<StoreIntegrationResponseDto> SaveCredentialsAsync(Guid tenantId, ShopifyCredentialsPayloadDto payload, CancellationToken cancellationToken = default);
    Task<string> GetOAuthUrlAsync(Guid tenantId, string shopDomain, CancellationToken cancellationToken = default);
    Task HandleOAuthCallbackAsync(Guid tenantId, string code, string shopDomain, CancellationToken cancellationToken = default);
    Task<ShopifyProductResponseDto> SyncProductAsync(Guid tenantId, ShopifySyncRequestDto request, CancellationToken cancellationToken = default);
    Task<ShopifyBulkSyncResponseDto> TriggerBulkSyncAsync(Guid tenantId, ShopifyBulkSyncRequestDto request, CancellationToken cancellationToken = default);
    Task<ShopifyProductResponseDto> UpdateInventoryAsync(Guid tenantId, string sku, ShopifyInventoryUpdateDto input, CancellationToken cancellationToken = default);
    Task<ShopifyProductResponseDto> UpdateStatusAsync(Guid tenantId, string sku, ShopifyStatusUpdateDto input, CancellationToken cancellationToken = default);
    Task<ShopifyProductResponseDto> DeleteRemoteProductAsync(Guid tenantId, string sku, CancellationToken cancellationToken = default);
    Task ProcessWebhookAsync(Guid tenantId, string topic, string shopDomain, JsonElement payload, CancellationToken cancellationToken = default);
}
