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
