using System;
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
    Task HandleOAuthCallbackAsync(Guid tenantId, string code);
    Task ProcessWebhookAsync(Guid tenantId, object payload);
    Task<NuvemshopBulkSyncResponse> TriggerBulkSyncAsync(Guid tenantId, NuvemshopBulkSyncRequest request);
}
