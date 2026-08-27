using System;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.Checkout;

public class PixPaymentRequestDto
{
    [JsonPropertyName("plan_id")]
    public string PlanId { get; set; } = string.Empty;

    [JsonPropertyName("tenant_id")]
    public string? TenantId { get; set; }

    [JsonPropertyName("payer_email")]
    public string? PayerEmail { get; set; }

    [JsonPropertyName("payer_document")]
    public string? PayerDocument { get; set; }
}

public class PixPaymentResponseDto
{
    [JsonPropertyName("payment_id")]
    public string PaymentId { get; set; } = string.Empty;

    [JsonPropertyName("qr_code_base64")]
    public string QrCodeBase64 { get; set; } = string.Empty;

    [JsonPropertyName("qr_code_copy_paste")]
    public string QrCodeCopyPaste { get; set; } = string.Empty;

    [JsonPropertyName("expires_at")]
    public string ExpiresAt { get; set; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; set; } = "PENDING";
}

public class CreditCardPaymentRequestDto
{
    [JsonPropertyName("plan_id")]
    public string PlanId { get; set; } = string.Empty;

    [JsonPropertyName("card_number")]
    public string? CardNumber { get; set; }

    [JsonPropertyName("cardholder_name")]
    public string? CardholderName { get; set; }

    [JsonPropertyName("expiration_month")]
    public string? ExpirationMonth { get; set; }

    [JsonPropertyName("expiration_year")]
    public string? ExpirationYear { get; set; }

    [JsonPropertyName("security_code")]
    public string? SecurityCode { get; set; }

    [JsonPropertyName("installments")]
    public int Installments { get; set; } = 1;

    [JsonPropertyName("doc_number")]
    public string? DocNumber { get; set; }

    [JsonPropertyName("card_token")]
    public string? CardToken { get; set; }

    [JsonPropertyName("payment_method_id")]
    public string? PaymentMethodId { get; set; }

    [JsonPropertyName("payer_email")]
    public string? PayerEmail { get; set; }
}

public class CreditCardPaymentResponseDto
{
    [JsonPropertyName("payment_id")]
    public string PaymentId { get; set; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; set; } = "PENDING";

    [JsonPropertyName("message")]
    public string? Message { get; set; }
}

public class OrderStatusSyncResponseDto
{
    [JsonPropertyName("payment_id")]
    public string PaymentId { get; set; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; set; } = "PENDING";

    [JsonPropertyName("is_approved")]
    public bool IsApproved { get; set; }
}
