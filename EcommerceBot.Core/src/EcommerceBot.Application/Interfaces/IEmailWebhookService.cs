using System.Text.Json;
using System.Threading.Tasks;

namespace EcommerceBot.Application.Interfaces;

public interface IEmailWebhookService
{
    Task<WebhookProcessResult> ProcessResendWebhookAsync(
        JsonElement payload,
        string? svixId,
        string? svixTimestamp,
        string? svixSignature);
}
