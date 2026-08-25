using System;

namespace EcommerceBot.Domain.Entities
{
    public class LlmUsageLog
    {
        public Guid Id { get; set; }
        public Guid TenantId { get; set; }
        public string? ProductId { get; set; }
        public string Provider { get; set; } = string.Empty;
        public string ModelUsed { get; set; } = string.Empty;
        public int PromptTokens { get; set; }
        public int CompletionTokens { get; set; }
        public int TotalTokens { get; set; }
        public decimal EstimatedCostUsd { get; set; }
        public bool IsByok { get; set; }
        public int? ExecutionTimeMs { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
    }
}
