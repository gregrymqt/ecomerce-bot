using System;
using System.Text.Json;
using System.Threading.Tasks;

namespace EcommerceBot.Application.Interfaces;

public interface IShopifyIntegrationService
{
    Task ProcessWebhookAsync(Guid tenantId, string topic, string shopDomain, JsonElement payload);
    Task HandleOAuthCallbackAsync(Guid tenantId, string code, string shopDomain);
}
