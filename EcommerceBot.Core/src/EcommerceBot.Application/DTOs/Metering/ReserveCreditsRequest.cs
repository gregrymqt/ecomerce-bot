namespace EcommerceBot.Application.DTOs.Metering;

public sealed record ReserveCreditsRequest
{
    public string ModelUsed { get; init; } = string.Empty;
    public int EstimatedPromptTokens { get; init; }
    public int EstimatedCompletionTokens { get; init; }
}
