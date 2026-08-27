using System;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Nuvemshop;

namespace EcommerceBot.Application.Interfaces;

public class NuvemshopBulkSyncResponse
{
    public string JobId { get; set; } = string.Empty;
    public int TotalEnqueued { get; set; }
    public string Status { get; set; } = "queued";
    public string Message { get; set; } = string.Empty;
}

public interface INuvemshopIntegrationService
{
    string GetOAuthUrl(Guid tenantId);
    Task<bool> HandleOAuthCallbackAsync(Guid tenantId, string code);
    Task<bool> SaveCredentialsAsync(Guid tenantId, NuvemshopCredentialsPayloadDto payload);
    Task<bool> RegisterWebhooksAsync(Guid tenantId);
    Task ProcessWebhookAsync(Guid tenantId, string topic, string eventId, string? resourceId, JsonElement payload);
    Task<NuvemshopBulkSyncResponse> TriggerBulkSyncAsync(Guid tenantId, NuvemshopBulkSyncRequest request);
    Task<bool> UpdateInventoryAsync(Guid tenantId, string sku, int quantity);
    Task<bool> UpdateProductStatusAsync(Guid tenantId, string sku, string status);
    Task<bool> DeleteRemoteProductAsync(Guid tenantId, string sku);
}
