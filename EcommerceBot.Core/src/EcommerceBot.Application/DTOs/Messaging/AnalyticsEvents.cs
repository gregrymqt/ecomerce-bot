using System;
using System.Collections.Generic;
using System.Text.Json;

namespace EcommerceBot.Application.DTOs.Messaging;

public sealed record CustomerTransactionDto
{
    public string CustomerId { get; init; } = string.Empty;
    public decimal Amount { get; init; }
    public DateTimeOffset Date { get; init; }
}

public sealed record MlAnalysisRequestMessage
{
    public Guid TenantId { get; init; }
    public string JobType { get; init; } = "FULL_ANALYTICS";
    public List<CustomerTransactionDto> Transactions { get; init; } = new();
}

public sealed record MlAnalysisResultMessage
{
    public Guid TenantId { get; init; }
    public string JobType { get; init; } = "FULL_ANALYTICS";
    public string Status { get; init; } = "SUCCESS";
    public JsonElement? Rfm { get; init; }
    public JsonElement? Churn { get; init; }
    public JsonElement? Ltv { get; init; }
    public string? ErrorMessage { get; init; }
}
