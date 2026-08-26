using System.Threading.Tasks;

namespace EcommerceBot.Application.Interfaces;

public enum WebhookResultStatus
{
    Success,
    AlreadyProcessed,
    InvalidSignature,
    MissingSecret,
    Error
}

public class WebhookProcessResult
{
    public WebhookResultStatus Status { get; set; }
    public string Message { get; set; } = string.Empty;
}

public interface IMercadoPagoWebhookService
{
    Task<WebhookProcessResult> ProcessWebhookAsync(
        string rawBody,
        string? dataId,
        string? idParam,
        string? xSignature,
        string? xRequestId);
}
