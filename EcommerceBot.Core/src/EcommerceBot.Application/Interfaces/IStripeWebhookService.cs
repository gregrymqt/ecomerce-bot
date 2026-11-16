using System.Threading;
using System.Threading.Tasks;

namespace EcommerceBot.Application.Interfaces;

public enum StripeWebhookResultStatus
{
    Success,
    AlreadyProcessed,
    InvalidSignature,
    MissingSecret,
    Error
}

public sealed class StripeWebhookProcessResult
{
    public StripeWebhookResultStatus Status { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? EventType { get; set; }
    public string? EventId { get; set; }
    public string? ResourceId { get; set; }
}

public interface IStripeWebhookService
{
    Task<StripeWebhookProcessResult> ProcessWebhookAsync(
        string rawPayload,
        string? stripeSignatureHeader,
        CancellationToken cancellationToken = default);
}
