using System;

namespace EcommerceBot.Application.DTOs.Messaging;

/// <summary>
/// Evento assíncrono emitido após inferência de LLM pelo worker Python para registro de telemetria e dedução de créditos.
/// </summary>
public class LlmUsageEvent
{
    public Guid TenantId { get; set; }
    public string? ProductId { get; set; }
    public string Provider { get; set; } = "openrouter";
    public string ModelUsed { get; set; } = "deepseek/deepseek-chat";
    public int PromptTokens { get; set; }
    public int CompletionTokens { get; set; }
    public int TotalTokens { get; set; }
    public decimal EstimatedCostUsd { get; set; }
    public bool IsByok { get; set; }
    public int ExecutionTimeMs { get; set; }
    public decimal? ReservedCost { get; set; }
}
