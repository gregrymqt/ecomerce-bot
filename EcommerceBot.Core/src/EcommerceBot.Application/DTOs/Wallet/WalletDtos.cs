using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.Wallet;

// =============================================================================
// RECHARGE REQUESTS (Frontend -> WalletController -> WalletService)
// =============================================================================

/// <summary>
/// Contrato unificado de recarga de carteira vindo do Frontend.
/// Válido para pagamentos via PIX e Cartão de Crédito.
/// </summary>
public sealed record CreateRechargeRequestDto
{
    /// <summary>
    /// Valor monetário da recarga em Reais (ex: 149.00).
    /// </summary>
    [JsonPropertyName("amount")]
    public decimal Amount { get; init; }

    /// <summary>
    /// Identificador opcional do pacote de créditos escolhido na tela de planos.
    /// </summary>
    [JsonPropertyName("package_id")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? PackageId { get; init; }

    /// <summary>
    /// Método de pagamento selecionado: "pix" ou "credit_card".
    /// </summary>
    [JsonPropertyName("payment_method")]
    public string PaymentMethod { get; init; } = "pix";

    // -------------------------------------------------------------------------
    // Campos específicos para Cartão de Crédito (Ignorados se for PIX)
    // -------------------------------------------------------------------------

    /// <summary>
    /// Token seguro do cartão gerado no frontend pelo SDK do gateway.
    /// </summary>
    [JsonPropertyName("card_token")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? CardToken { get; init; }

    /// <summary>
    /// Bandeira do cartão (ex: "credit_card", "bank_transfer").
    /// </summary>
    [JsonPropertyName("payment_method_id")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? PaymentMethodId { get; init; }

    /// <summary>
    /// Número de parcelas (padrão 1).
    /// </summary>
    [JsonPropertyName("installments")]
    public int Installments { get; init; } = 1;

    // -------------------------------------------------------------------------
    // Dados do Pagador e Faturamento Fiscal
    // -------------------------------------------------------------------------

    /// <summary>
    /// Dados do pagador (obrigatório para emissão de PIX e antifraude de cartão).
    /// </summary>
    [JsonPropertyName("payer")]
    public RechargePayerDto? Payer { get; init; }
}

public sealed record RechargePayerDto
{
    [JsonPropertyName("first_name")]
    public string? FirstName { get; init; }

    [JsonPropertyName("last_name")]
    public string? LastName { get; init; }

    [JsonPropertyName("email")]
    public string? Email { get; init; }

    [JsonPropertyName("identification_type")]
    public string IdentificationType { get; init; } = "CPF"; // "CPF" ou "CNPJ"

    [JsonPropertyName("identification_number")]
    public string? IdentificationNumber { get; init; }

    [JsonPropertyName("address")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public RechargeBillingAddressDto? Address { get; init; }
}

public sealed record RechargeBillingAddressDto
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

    [JsonPropertyName("federal_unit")]
    public string? FederalUnit { get; init; } // ex: "SP", "RJ"

    [JsonPropertyName("complement")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Complement { get; init; }
}

// =============================================================================
// RECHARGE RESPONSES (WalletService -> WalletController -> Frontend)
// =============================================================================

/// <summary>
/// Resposta padronizada para o Frontend após iniciar a recarga.
/// </summary>
public sealed record RechargeResponseDto
{
    [JsonPropertyName("order_id")]
    public Guid OrderId { get; init; }

    [JsonPropertyName("payment_id")]
    public string PaymentId { get; init; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; init; } = "pending"; // "approved" | "pending" | "rejected"

    [JsonPropertyName("payment_method")]
    public string PaymentMethod { get; init; } = "pix";

    [JsonPropertyName("total_amount")]
    public decimal TotalAmount { get; init; }

    [JsonPropertyName("credits_added")]
    public int? CreditsAdded { get; init; }

    // Campos preenchidos quando for PIX
    [JsonPropertyName("pix_qr_code")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? PixQrCode { get; init; } // Copia e Cola

    [JsonPropertyName("pix_qr_code_base64")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? PixQrCodeBase64 { get; init; } // Imagem do QR Code

    [JsonPropertyName("ticket_url")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? TicketUrl { get; init; }

    [JsonPropertyName("expiration_date")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public DateTimeOffset? ExpirationDate { get; init; }
}

// =============================================================================
// WALLET BALANCE & STATEMENTS
// =============================================================================

public sealed record WalletBalanceResponseDto
{
    [JsonPropertyName("tenant_id")]
    public Guid TenantId { get; init; }

    [JsonPropertyName("balance_credits")]
    public int BalanceCredits { get; init; }

    [JsonPropertyName("credits_balance")]
    public int CreditsBalance => BalanceCredits;

    [JsonPropertyName("managed_credit_balance")]
    public decimal ManagedCreditBalance { get; init; }

    [JsonPropertyName("updated_at")]
    public DateTimeOffset UpdatedAt { get; init; }
}

public sealed record CreditTransactionDto
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    [JsonPropertyName("tenant_id")]
    public Guid TenantId { get; init; }

    [JsonPropertyName("amount")]
    public decimal Amount { get; init; }

    [JsonPropertyName("balance_after")]
    public int BalanceAfter { get; init; }

    [JsonPropertyName("type")]
    public string Type { get; init; } = "RECHARGE"; // 'WELCOME_BONUS' | 'RECHARGE' | 'PRODUCT_ENRICHMENT' | 'REFUND'

    [JsonPropertyName("category")]
    public string Category => (Amount > 0 || Type == "RECHARGE" || Type == "WELCOME_BONUS" || Type == "REFUND") ? "RECHARGE" : "USAGE";

    [JsonPropertyName("is_positive")]
    public bool IsPositive => Amount > 0 || Type == "RECHARGE" || Type == "WELCOME_BONUS" || Type == "REFUND";

    [JsonPropertyName("description")]
    public string? Description { get; init; }

    [JsonPropertyName("reference_id")]
    public string? ReferenceId { get; init; }

    [JsonPropertyName("external_payment_id")]
    public string? ExternalPaymentId { get; init; }

    [JsonPropertyName("created_at")]
    public DateTimeOffset CreatedAt { get; init; }
}

public sealed record WalletStatementResponseDto
{
    [JsonPropertyName("balance_credits")]
    public int BalanceCredits { get; init; }

    [JsonPropertyName("managed_credit_balance")]
    public decimal ManagedCreditBalance { get; init; }

    [JsonPropertyName("transactions")]
    public List<CreditTransactionDto> Transactions { get; init; } = [];

    [JsonPropertyName("total_count")]
    public int TotalCount { get; init; }
}

public sealed record StatementFiltersDto
{
    public int Page { get; init; } = 1;
    public int Limit { get; init; } = 20;
    public string? Type { get; init; } // 'RECHARGE' | 'USAGE' | 'ALL'
}