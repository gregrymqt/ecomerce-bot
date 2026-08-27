using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.MercadoPago;

public class MercadoPagoOrderRequest
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = "online";

    [JsonPropertyName("processing_mode")]
    public string ProcessingMode { get; set; } = "automatic";

    [JsonPropertyName("external_reference")]
    public string? ExternalReference { get; set; }

    [JsonPropertyName("total_amount")]
    public string TotalAmount { get; set; } = "0.00";

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("payer")]
    public MercadoPagoPayerRequest? Payer { get; set; }

    [JsonPropertyName("shipment")]
    public MercadoPagoShipmentRequest? Shipment { get; set; }

    [JsonPropertyName("transactions")]
    public MercadoPagoTransactionsRequest? Transactions { get; set; }

    [JsonPropertyName("items")]
    public List<MercadoPagoItemRequest>? Items { get; set; }

    [JsonPropertyName("config")]
    public MercadoPagoConfigRequest? Config { get; set; }
}

public class MercadoPagoPayerRequest
{
    [JsonPropertyName("email")]
    public string? Email { get; set; }

    [JsonPropertyName("entity_type")]
    public string? EntityType { get; set; } = "individual";

    [JsonPropertyName("first_name")]
    public string? FirstName { get; set; }

    [JsonPropertyName("last_name")]
    public string? LastName { get; set; }

    [JsonPropertyName("identification")]
    public MercadoPagoIdentificationRequest? Identification { get; set; }

    [JsonPropertyName("phone")]
    public MercadoPagoPhoneRequest? Phone { get; set; }

    [JsonPropertyName("address")]
    public MercadoPagoAddressRequest? Address { get; set; }
}

public class MercadoPagoIdentificationRequest
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = "CPF";

    [JsonPropertyName("number")]
    public string Number { get; set; } = string.Empty;
}

public class MercadoPagoPhoneRequest
{
    [JsonPropertyName("area_code")]
    public string? AreaCode { get; set; }

    [JsonPropertyName("number")]
    public string? Number { get; set; }
}

public class MercadoPagoAddressRequest
{
    [JsonPropertyName("zip_code")]
    public string? ZipCode { get; set; }

    [JsonPropertyName("street_name")]
    public string? StreetName { get; set; }

    [JsonPropertyName("street_number")]
    public string? StreetNumber { get; set; }

    [JsonPropertyName("neighborhood")]
    public string? Neighborhood { get; set; }

    [JsonPropertyName("city")]
    public string? City { get; set; }

    [JsonPropertyName("state")]
    public string? State { get; set; }

    [JsonPropertyName("complement")]
    public string? Complement { get; set; }
}

public class MercadoPagoShipmentRequest
{
    [JsonPropertyName("address")]
    public MercadoPagoAddressRequest? Address { get; set; }
}

public class MercadoPagoTransactionsRequest
{
    [JsonPropertyName("payments")]
    public MercadoPagoPaymentRequest? Payments { get; set; }
}

public class MercadoPagoPaymentRequest
{
    [JsonPropertyName("amount")]
    public string Amount { get; set; } = "0.00";

    [JsonPropertyName("payment_method")]
    public MercadoPagoPaymentMethodRequest? PaymentMethod { get; set; }

    [JsonPropertyName("expiration_time")]
    public string? ExpirationTime { get; set; }

    [JsonPropertyName("date_of_expiration")]
    public string? DateOfExpiration { get; set; }
}

public class MercadoPagoPaymentMethodRequest
{
    [JsonPropertyName("id")]
    public string? Id { get; set; } // "pix", "visa", "master", "boleto", etc.

    [JsonPropertyName("type")]
    public string? Type { get; set; } // "credit_card", "bank_transfer", "ticket"

    [JsonPropertyName("token")]
    public string? Token { get; set; }

    [JsonPropertyName("installments")]
    public int? Installments { get; set; }

    [JsonPropertyName("statement_descriptor")]
    public string? StatementDescriptor { get; set; }
}

public class MercadoPagoItemRequest
{
    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("unit_price")]
    public string UnitPrice { get; set; } = "0.00";

    [JsonPropertyName("quantity")]
    public int Quantity { get; set; } = 1;

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("external_code")]
    public string? ExternalCode { get; set; }
}

public class MercadoPagoConfigRequest
{
    [JsonPropertyName("online")]
    public MercadoPagoOnlineConfigRequest? Online { get; set; }
}

public class MercadoPagoOnlineConfigRequest
{
    [JsonPropertyName("transaction_security")]
    public MercadoPagoTransactionSecurityRequest? TransactionSecurity { get; set; }

    [JsonPropertyName("callback_url")]
    public string? CallbackUrl { get; set; }
}

public class MercadoPagoTransactionSecurityRequest
{
    [JsonPropertyName("validation")]
    public string Validation { get; set; } = "never"; // "on_fraud_risk", "never"

    [JsonPropertyName("liability_shift")]
    public string? LiabilityShift { get; set; }
}

// -------------------------------------------------------------
// Respostas da API /v1/orders
// -------------------------------------------------------------

public class MercadoPagoOrderResponse
{
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("type")]
    public string? Type { get; set; }

    [JsonPropertyName("processing_mode")]
    public string? ProcessingMode { get; set; }

    [JsonPropertyName("external_reference")]
    public string? ExternalReference { get; set; }

    [JsonPropertyName("total_amount")]
    public object? TotalAmount { get; set; }

    [JsonPropertyName("total_paid_amount")]
    public object? TotalPaidAmount { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonPropertyName("status_detail")]
    public string? StatusDetail { get; set; }

    [JsonPropertyName("created_date")]
    public string? CreatedDate { get; set; }

    [JsonPropertyName("last_updated_date")]
    public string? LastUpdatedDate { get; set; }

    [JsonPropertyName("country_code")]
    public string? CountryCode { get; set; }

    [JsonPropertyName("capture_mode")]
    public string? CaptureMode { get; set; }

    [JsonPropertyName("transactions")]
    public MercadoPagoOrderTransactionsResponse? Transactions { get; set; }
}

public class MercadoPagoOrderTransactionsResponse
{
    [JsonPropertyName("payments")]
    public List<MercadoPagoOrderPaymentResponse>? Payments { get; set; }
}

public class MercadoPagoOrderPaymentResponse
{
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("amount")]
    public object? Amount { get; set; }

    [JsonPropertyName("paid_amount")]
    public object? PaidAmount { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonPropertyName("status_detail")]
    public string? StatusDetail { get; set; }

    [JsonPropertyName("date_of_expiration")]
    public string? DateOfExpiration { get; set; }

    [JsonPropertyName("payment_method")]
    public MercadoPagoOrderPaymentMethodResponse? PaymentMethod { get; set; }
}

public class MercadoPagoOrderPaymentMethodResponse
{
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("type")]
    public string? Type { get; set; }

    [JsonPropertyName("qr_code")]
    public string? QrCode { get; set; }

    [JsonPropertyName("qr_code_base64")]
    public string? QrCodeBase64 { get; set; }

    [JsonPropertyName("ticket_url")]
    public string? TicketUrl { get; set; }

    [JsonPropertyName("e2e_id")]
    public string? E2eId { get; set; }
}

// -------------------------------------------------------------
// Resposta da API /v1/payments/{id} (Fallback)
// -------------------------------------------------------------

public class MercadoPagoPaymentResponse
{
    [JsonPropertyName("id")]
    public object? Id { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonPropertyName("status_detail")]
    public string? StatusDetail { get; set; }

    [JsonPropertyName("transaction_amount")]
    public decimal? TransactionAmount { get; set; }

    [JsonPropertyName("external_reference")]
    public string? ExternalReference { get; set; }

    [JsonPropertyName("payment_method_id")]
    public string? PaymentMethodId { get; set; }

    [JsonPropertyName("date_approved")]
    public DateTimeOffset? DateApproved { get; set; }

    [JsonPropertyName("payer")]
    public MercadoPagoPayerRequest? Payer { get; set; }

    [JsonPropertyName("point_of_interaction")]
    public MercadoPagoPointOfInteraction? PointOfInteraction { get; set; }
}

public class MercadoPagoPointOfInteraction
{
    [JsonPropertyName("transaction_data")]
    public MercadoPagoTransactionData? TransactionData { get; set; }
}

public class MercadoPagoTransactionData
{
    [JsonPropertyName("qr_code")]
    public string? QrCode { get; set; }

    [JsonPropertyName("qr_code_base64")]
    public string? QrCodeBase64 { get; set; }

    [JsonPropertyName("ticket_url")]
    public string? TicketUrl { get; set; }
}
