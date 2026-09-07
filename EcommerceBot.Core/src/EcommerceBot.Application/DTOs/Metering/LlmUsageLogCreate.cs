using System;

namespace EcommerceBot.Application.DTOs.Metering;

public sealed record LlmUsageLogCreate
{
    public string? ProductId { get; init; }
    public string Provider { get; init; } = string.Empty;
    public string ModelUsed { get; init; } = string.Empty;
    public int PromptTokens { get; init; }
    public int CompletionTokens { get; init; }
    public int TotalTokens { get; init; }
    public decimal EstimatedCostUsd { get; init; }
    public bool IsByok { get; init; }
    public int? ExecutionTimeMs { get; init; }
    public decimal? ReservedCost { get; init; }
}
