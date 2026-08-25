using System;

namespace EcommerceBot.Application.DTOs.Metering
{
    public class LlmUsageLogCreate
    {
        public string? ProductId { get; set; }
        public string Provider { get; set; } = string.Empty;
        public string ModelUsed { get; set; } = string.Empty;
        public int PromptTokens { get; set; }
        public int CompletionTokens { get; set; }
        public int TotalTokens { get; set; }
        public decimal EstimatedCostUsd { get; set; }
        public bool IsByok { get; set; }
        public int? ExecutionTimeMs { get; set; }
        public decimal? ReservedCost { get; set; }
    }
}
