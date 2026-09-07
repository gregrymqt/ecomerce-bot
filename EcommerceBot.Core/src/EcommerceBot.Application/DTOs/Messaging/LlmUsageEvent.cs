using System;

namespace EcommerceBot.Application.DTOs.Messaging;

/// <summary>
/// Evento assíncrono emitido após inferência de LLM pelo worker Python para registro de telemetria e dedução de créditos.
/// </summary>
public sealed record LlmUsageEvent
{
    public Guid TenantId { get; init; }
    public string? ProductId { get; init; }
    public string Provider { get; init; } = "openrouter";
    public string ModelUsed { get; init; } = "deepseek/deepseek-chat";
    public int PromptTokens { get; init; }
    public int CompletionTokens { get; init; }
    public int TotalTokens { get; init; }
    public decimal EstimatedCostUsd { get; init; }
    public bool IsByok { get; init; }
    public int ExecutionTimeMs { get; init; }
    public decimal? ReservedCost { get; init; }
}
