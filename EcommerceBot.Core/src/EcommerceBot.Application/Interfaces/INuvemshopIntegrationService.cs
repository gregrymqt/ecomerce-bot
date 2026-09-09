using System;
using System.Text.Json;
using System.Threading;
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
    Task<bool> HandleOAuthCallbackAsync(Guid tenantId, string code, CancellationToken cancellationToken = default);
    Task<bool> SaveCredentialsAsync(Guid tenantId, NuvemshopCredentialsPayloadDto payload, CancellationToken cancellationToken = default);
    Task<bool> RegisterWebhooksAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task ProcessWebhookAsync(Guid tenantId, string topic, string eventId, string? resourceId, JsonElement payload, CancellationToken cancellationToken = default);
    Task<NuvemshopBulkSyncResponse> TriggerBulkSyncAsync(Guid tenantId, NuvemshopBulkSyncRequest request, CancellationToken cancellationToken = default);
    Task<bool> UpdateInventoryAsync(Guid tenantId, string sku, int quantity, CancellationToken cancellationToken = default);
    Task<bool> UpdateProductStatusAsync(Guid tenantId, string sku, string status, CancellationToken cancellationToken = default);
    Task<bool> DeleteRemoteProductAsync(Guid tenantId, string sku, CancellationToken cancellationToken = default);
}
