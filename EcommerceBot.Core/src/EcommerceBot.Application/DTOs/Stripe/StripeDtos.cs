using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.Stripe;

// =============================================================================
// PAYMENTS (PaymentIntent)
// =============================================================================

public sealed record CreatePaymentIntentRequest
{
    [JsonPropertyName("amount")]
    public required decimal Amount { get; init; }

    [JsonPropertyName("currency")]
    public string Currency { get; init; } = "brl";

    [JsonPropertyName("description")]
    public string? Description { get; init; }

    [JsonPropertyName("customer_id")]
    public string? CustomerId { get; init; }

    [JsonPropertyName("customer_email")]
    public string? CustomerEmail { get; init; }

    [JsonPropertyName("metadata")]
    public Dictionary<string, string> Metadata { get; init; } = new();

    [JsonPropertyName("enable_automatic_tax")]
    public bool EnableAutomaticTax { get; init; } = true;
}

public sealed record PaymentIntentResponse
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    [JsonPropertyName("client_secret")]
    public string? ClientSecret { get; init; }

    [JsonPropertyName("status")]
    public string Status { get; init; } = string.Empty;

    [JsonPropertyName("amount")]
    public decimal Amount { get; init; }

    [JsonPropertyName("currency")]
    public string Currency { get; init; } = "brl";

    [JsonPropertyName("customer_id")]
    public string? CustomerId { get; init; }

    [JsonPropertyName("invoice_id")]
    public string? InvoiceId { get; init; }

    [JsonPropertyName("metadata")]
    public Dictionary<string, string> Metadata { get; init; } = new();
}

public sealed record RefundRequest
{
    [JsonPropertyName("payment_intent_id")]
    public required string PaymentIntentId { get; init; }

    [JsonPropertyName("amount")]
    public decimal? Amount { get; init; }

    [JsonPropertyName("reason")]
    public string? Reason { get; init; }
}

public sealed record RefundResponse
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; init; } = string.Empty;

    [JsonPropertyName("amount")]
    public decimal Amount { get; init; }

    [JsonPropertyName("payment_intent_id")]
    public string PaymentIntentId { get; init; } = string.Empty;
}

// =============================================================================
// BILLING & SUBSCRIPTIONS
// =============================================================================

public sealed record CreateCustomerRequest
{
    [JsonPropertyName("email")]
    public required string Email { get; init; }

    [JsonPropertyName("name")]
    public string? Name { get; init; }

    [JsonPropertyName("metadata")]
    public Dictionary<string, string> Metadata { get; init; } = new();
}

public sealed record CustomerResponse
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    [JsonPropertyName("email")]
    public string Email { get; init; } = string.Empty;

    [JsonPropertyName("name")]
    public string? Name { get; init; }
}

public sealed record CreateSubscriptionRequest
{
    [JsonPropertyName("customer_id")]
    public required string CustomerId { get; init; }

    [JsonPropertyName("price_id")]
    public required string PriceId { get; init; }

    [JsonPropertyName("enable_automatic_tax")]
    public bool EnableAutomaticTax { get; init; } = true;

    [JsonPropertyName("metadata")]
    public Dictionary<string, string> Metadata { get; init; } = new();
}

public sealed record SubscriptionResponse
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    [JsonPropertyName("customer_id")]
    public string CustomerId { get; init; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; init; } = string.Empty;

    [JsonPropertyName("latest_invoice_id")]
    public string? LatestInvoiceId { get; init; }

    [JsonPropertyName("client_secret")]
    public string? ClientSecret { get; init; }
}

public sealed record CreateBillingPortalSessionRequest
{
    [JsonPropertyName("customer_id")]
    public required string CustomerId { get; init; }

    [JsonPropertyName("return_url")]
    public required string ReturnUrl { get; init; }
}

public sealed record BillingPortalSessionResponse
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    [JsonPropertyName("url")]
    public string Url { get; init; } = string.Empty;
}

// =============================================================================
// INVOICING
// =============================================================================

public sealed record InvoiceResponse
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    [JsonPropertyName("customer_id")]
    public string? CustomerId { get; init; }

    [JsonPropertyName("subscription_id")]
    public string? SubscriptionId { get; init; }

    [JsonPropertyName("payment_intent_id")]
    public string? PaymentIntentId { get; init; }

    [JsonPropertyName("status")]
    public string Status { get; init; } = string.Empty;

    [JsonPropertyName("amount_due")]
    public decimal AmountDue { get; init; }

    [JsonPropertyName("amount_paid")]
    public decimal AmountPaid { get; init; }

    [JsonPropertyName("hosted_invoice_url")]
    public string? HostedInvoiceUrl { get; init; }

    [JsonPropertyName("invoice_pdf")]
    public string? InvoicePdf { get; init; }
}
