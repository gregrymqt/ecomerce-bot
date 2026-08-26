using System;
using System.Collections.Generic;
using System.Text.Json;

namespace EcommerceBot.Application.DTOs.Messaging;

public class CustomerTransactionDto
{
    public string CustomerId { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public DateTimeOffset Date { get; set; }
}

public class MlAnalysisRequestMessage
{
    public Guid TenantId { get; set; }
    public string JobType { get; set; } = "FULL_ANALYTICS";
    public List<CustomerTransactionDto> Transactions { get; set; } = new();
}

public class MlAnalysisResultMessage
{
    public Guid TenantId { get; set; }
    public string JobType { get; set; } = "FULL_ANALYTICS";
    public string Status { get; set; } = "SUCCESS";
    public JsonElement? Rfm { get; set; }
    public JsonElement? Churn { get; set; }
    public JsonElement? Ltv { get; set; }
    public string? ErrorMessage { get; set; }
}
