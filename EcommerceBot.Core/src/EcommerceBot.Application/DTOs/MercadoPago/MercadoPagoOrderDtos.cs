using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.MercadoPago;

public sealed record MercadoPagoOrderRequest
{
    [JsonPropertyName("type")]
    public string Type { get; init; } = "online";

    [JsonPropertyName("processing_mode")]
    public string ProcessingMode { get; init; } = "automatic";

    [JsonPropertyName("external_reference")]
    public string? ExternalReference { get; init; }

    [JsonPropertyName("total_amount")]
    public string TotalAmount { get; init; } = "0.00";

    [JsonPropertyName("description")]
    public string? Description { get; init; }

    [JsonPropertyName("payer")]
    public MercadoPagoPayerRequest? Payer { get; init; }

    [JsonPropertyName("shipment")]
    public MercadoPagoShipmentRequest? Shipment { get; init; }

    [JsonPropertyName("transactions")]
    public MercadoPagoTransactionsRequest? Transactions { get; init; }

    [JsonPropertyName("items")]
    public List<MercadoPagoItemRequest>? Items { get; init; }

    [JsonPropertyName("config")]
    public MercadoPagoConfigRequest? Config { get; init; }
}

public sealed record MercadoPagoPayerRequest
{
    [JsonPropertyName("email")]
    public string? Email { get; init; }

    [JsonPropertyName("entity_type")]
    public string? EntityType { get; init; } = "individual";

    [JsonPropertyName("first_name")]
    public string? FirstName { get; init; }

    [JsonPropertyName("last_name")]
    public string? LastName { get; init; }

    [JsonPropertyName("identification")]
    public MercadoPagoIdentificationRequest? Identification { get; init; }

    [JsonPropertyName("phone")]
    public MercadoPagoPhoneRequest? Phone { get; init; }

    [JsonPropertyName("address")]
    public MercadoPagoAddressRequest? Address { get; init; }
}

public sealed record MercadoPagoIdentificationRequest
{
    [JsonPropertyName("type")]
    public string Type { get; init; } = "CPF";

    [JsonPropertyName("number")]
    public string Number { get; init; } = string.Empty;
}

public sealed record MercadoPagoPhoneRequest
{
    [JsonPropertyName("area_code")]
    public string? AreaCode { get; init; }

    [JsonPropertyName("number")]
    public string? Number { get; init; }
}

public sealed record MercadoPagoAddressRequest
{
    [JsonPropertyName("zip_code")]
    public string? ZipCode { get; init; }

    [JsonPropertyName("street_name")]
    public string? StreetName { get; init; }

    [JsonPropertyName("street_number")]
    public string? StreetNumber { get; init; }

    [JsonPropertyName("neighborhood")]
    public string? Neighborhood { get; init; }

    [JsonPropertyName("city")]
    public string? City { get; init; }

    [JsonPropertyName("state")]
    public string? State { get; init; }

    [JsonPropertyName("complement")]
    public string? Complement { get; init; }
}

public sealed record MercadoPagoShipmentRequest
{
    [JsonPropertyName("address")]
    public MercadoPagoAddressRequest? Address { get; init; }
}

public sealed record MercadoPagoTransactionsRequest
{
    [JsonPropertyName("payments")]
    public MercadoPagoPaymentRequest? Payments { get; init; }
}

public sealed record MercadoPagoPaymentRequest
{
    [JsonPropertyName("amount")]
    public string Amount { get; init; } = "0.00";

    [JsonPropertyName("payment_method")]
    public MercadoPagoPaymentMethodRequest? PaymentMethod { get; init; }

    [JsonPropertyName("expiration_time")]
    public string? ExpirationTime { get; init; }

    [JsonPropertyName("date_of_expiration")]
    public string? DateOfExpiration { get; init; }
}

public sealed record MercadoPagoPaymentMethodRequest
{
    [JsonPropertyName("id")]
    public string? Id { get; init; } // "pix", "visa", "master", "boleto", etc.

    [JsonPropertyName("type")]
    public string? Type { get; init; } // "credit_card", "bank_transfer", "ticket"

    [JsonPropertyName("token")]
    public string? Token { get; init; }

    [JsonPropertyName("installments")]
    public int? Installments { get; init; }

    [JsonPropertyName("statement_descriptor")]
    public string? StatementDescriptor { get; init; }
}

public sealed record MercadoPagoItemRequest
{
    [JsonPropertyName("title")]
    public string Title { get; init; } = string.Empty;

    [JsonPropertyName("unit_price")]
    public string UnitPrice { get; init; } = "0.00";

    [JsonPropertyName("quantity")]
    public int Quantity { get; init; } = 1;

    [JsonPropertyName("description")]
    public string? Description { get; init; }

    [JsonPropertyName("external_code")]
    public string? ExternalCode { get; init; }
}

public sealed record MercadoPagoConfigRequest
{
    [JsonPropertyName("online")]
    public MercadoPagoOnlineConfigRequest? Online { get; init; }
}

public sealed record MercadoPagoOnlineConfigRequest
{
    [JsonPropertyName("transaction_security")]
    public MercadoPagoTransactionSecurityRequest? TransactionSecurity { get; init; }

    [JsonPropertyName("callback_url")]
    public string? CallbackUrl { get; init; }
}

public sealed record MercadoPagoTransactionSecurityRequest
{
    [JsonPropertyName("validation")]
    public string Validation { get; init; } = "never"; // "on_fraud_risk", "never"

    [JsonPropertyName("liability_shift")]
    public string? LiabilityShift { get; init; }
}

// -------------------------------------------------------------
// Respostas da API /v1/orders
// -------------------------------------------------------------

public sealed record MercadoPagoOrderResponse
{
    [JsonPropertyName("id")]
    public string? Id { get; init; }

    [JsonPropertyName("type")]
    public string? Type { get; init; }

    [JsonPropertyName("processing_mode")]
    public string? ProcessingMode { get; init; }

    [JsonPropertyName("external_reference")]
    public string? ExternalReference { get; init; }

    [JsonPropertyName("total_amount")]
    public object? TotalAmount { get; init; }

    [JsonPropertyName("total_paid_amount")]
    public object? TotalPaidAmount { get; init; }

    [JsonPropertyName("status")]
    public string? Status { get; init; }

    [JsonPropertyName("status_detail")]
    public string? StatusDetail { get; init; }

    [JsonPropertyName("created_date")]
    public string? CreatedDate { get; init; }

    [JsonPropertyName("last_updated_date")]
    public string? LastUpdatedDate { get; init; }

    [JsonPropertyName("country_code")]
    public string? CountryCode { get; init; }

    [JsonPropertyName("capture_mode")]
    public string? CaptureMode { get; init; }

    [JsonPropertyName("transactions")]
    public MercadoPagoOrderTransactionsResponse? Transactions { get; init; }
}

public sealed record MercadoPagoOrderTransactionsResponse
{
    [JsonPropertyName("payments")]
    public List<MercadoPagoOrderPaymentResponse>? Payments { get; init; }
}

public sealed record MercadoPagoOrderPaymentResponse
{
    [JsonPropertyName("id")]
    public string? Id { get; init; }

    [JsonPropertyName("amount")]
    public object? Amount { get; init; }

    [JsonPropertyName("paid_amount")]
    public object? PaidAmount { get; init; }

    [JsonPropertyName("status")]
    public string? Status { get; init; }

    [JsonPropertyName("status_detail")]
    public string? StatusDetail { get; init; }

    [JsonPropertyName("date_of_expiration")]
    public string? DateOfExpiration { get; init; }

    [JsonPropertyName("payment_method")]
    public MercadoPagoOrderPaymentMethodResponse? PaymentMethod { get; init; }
}

public sealed record MercadoPagoOrderPaymentMethodResponse
{
    [JsonPropertyName("id")]
    public string? Id { get; init; }

    [JsonPropertyName("type")]
    public string? Type { get; init; }

    [JsonPropertyName("qr_code")]
    public string? QrCode { get; init; }

    [JsonPropertyName("qr_code_base64")]
    public string? QrCodeBase64 { get; init; }

    [JsonPropertyName("ticket_url")]
    public string? TicketUrl { get; init; }

    [JsonPropertyName("e2e_id")]
    public string? E2eId { get; init; }
}

// -------------------------------------------------------------
// Resposta da API /v1/payments/{id} (Fallback)
// -------------------------------------------------------------

public sealed record MercadoPagoPaymentResponse
{
    [JsonPropertyName("id")]
    public object? Id { get; init; }

    [JsonPropertyName("status")]
    public string? Status { get; init; }

    [JsonPropertyName("status_detail")]
    public string? StatusDetail { get; init; }

    [JsonPropertyName("transaction_amount")]
    public decimal? TransactionAmount { get; init; }

    [JsonPropertyName("external_reference")]
    public string? ExternalReference { get; init; }

    [JsonPropertyName("payment_method_id")]
    public string? PaymentMethodId { get; init; }

    [JsonPropertyName("date_approved")]
    public DateTimeOffset? DateApproved { get; init; }

    [JsonPropertyName("payer")]
    public MercadoPagoPayerRequest? Payer { get; init; }

    [JsonPropertyName("point_of_interaction")]
    public MercadoPagoPointOfInteraction? PointOfInteraction { get; init; }
}

public sealed record MercadoPagoPointOfInteraction
{
    [JsonPropertyName("transaction_data")]
    public MercadoPagoTransactionData? TransactionData { get; init; }
}

public sealed record MercadoPagoTransactionData
{
    [JsonPropertyName("qr_code")]
    public string? QrCode { get; init; }

    [JsonPropertyName("qr_code_base64")]
    public string? QrCodeBase64 { get; init; }

    [JsonPropertyName("ticket_url")]
    public string? TicketUrl { get; init; }
}
