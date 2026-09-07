using System;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.Checkout;

public sealed record PixPaymentRequestDto
{
    [JsonPropertyName("plan_id")]
    public string PlanId { get; init; } = string.Empty;

    [JsonPropertyName("tenant_id")]
    public string? TenantId { get; init; }

    [JsonPropertyName("payer_email")]
    public string? PayerEmail { get; init; }

    [JsonPropertyName("payer_document")]
    public string? PayerDocument { get; init; }
}

public sealed record PixPaymentResponseDto
{
    [JsonPropertyName("payment_id")]
    public string PaymentId { get; init; } = string.Empty;

    [JsonPropertyName("qr_code_base64")]
    public string QrCodeBase64 { get; init; } = string.Empty;

    [JsonPropertyName("qr_code_copy_paste")]
    public string QrCodeCopyPaste { get; init; } = string.Empty;

    [JsonPropertyName("expires_at")]
    public string ExpiresAt { get; init; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; init; } = "PENDING";
}

public sealed record CreditCardPaymentRequestDto
{
    [JsonPropertyName("plan_id")]
    public string PlanId { get; init; } = string.Empty;

    [JsonPropertyName("card_number")]
    public string? CardNumber { get; init; }

    [JsonPropertyName("cardholder_name")]
    public string? CardholderName { get; init; }

    [JsonPropertyName("expiration_month")]
    public string? ExpirationMonth { get; init; }

    [JsonPropertyName("expiration_year")]
    public string? ExpirationYear { get; init; }

    [JsonPropertyName("security_code")]
    public string? SecurityCode { get; init; }

    [JsonPropertyName("installments")]
    public int Installments { get; init; } = 1;

    [JsonPropertyName("doc_number")]
    public string? DocNumber { get; init; }

    [JsonPropertyName("card_token")]
    public string? CardToken { get; init; }

    [JsonPropertyName("payment_method_id")]
    public string? PaymentMethodId { get; init; }

    [JsonPropertyName("payer_email")]
    public string? PayerEmail { get; init; }
}

public sealed record CreditCardPaymentResponseDto
{
    [JsonPropertyName("payment_id")]
    public string PaymentId { get; init; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; init; } = "PENDING";

    [JsonPropertyName("message")]
    public string? Message { get; init; }
}

public sealed record OrderStatusSyncResponseDto
{
    [JsonPropertyName("payment_id")]
    public string PaymentId { get; init; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; init; } = "PENDING";

    [JsonPropertyName("is_approved")]
    public bool IsApproved { get; init; }
}
