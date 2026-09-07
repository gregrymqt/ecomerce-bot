using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.Wallet;

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
    public List<CreditTransactionDto> Transactions { get; init; } = new();

    [JsonPropertyName("total_count")]
    public int TotalCount { get; init; }
}

public sealed record RechargeRequestDto
{
    [JsonPropertyName("credits_package")]
    public int CreditsPackage { get; init; }

    [JsonPropertyName("package_id")]
    public string? PackageId { get; init; }

    [JsonPropertyName("amount")]
    public decimal Amount { get; init; }

    [JsonPropertyName("payment_method")]
    public string PaymentMethod { get; init; } = "pix"; // 'pix' | 'credit_card'

    [JsonPropertyName("card_token")]
    public string? CardToken { get; init; }

    [JsonPropertyName("payment_method_id")]
    public string? PaymentMethodId { get; init; }

    [JsonPropertyName("installments")]
    public int Installments { get; init; } = 1;

    [JsonPropertyName("payer_email")]
    public string? PayerEmail { get; init; }

    [JsonPropertyName("payer")]
    public CardPaymentPayerDto? Payer { get; init; }
}

public sealed record CardPaymentPayerDto
{
    [JsonPropertyName("email")]
    public string? Email { get; init; }

    [JsonPropertyName("identification")]
    public IdentificationDto? Identification { get; init; }
}

public sealed record IdentificationDto
{
    [JsonPropertyName("type")]
    public string Type { get; init; } = "CPF";

    [JsonPropertyName("number")]
    public string Number { get; init; } = string.Empty;
}

public sealed record RechargeResponseDto
{
    [JsonPropertyName("payment_id")]
    public string PaymentId { get; init; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; init; } = "pending";

    [JsonPropertyName("pix_qr_code")]
    public string? PixQrCode { get; init; }

    [JsonPropertyName("pix_copia_e_cola")]
    public string? PixCopiaECola { get; init; }

    [JsonPropertyName("expiration_date")]
    public string? ExpirationDate { get; init; }
}

public sealed record StatementFiltersDto
{
    public int Page { get; init; } = 1;
    public int Limit { get; init; } = 20;
    public string? Type { get; init; } // 'RECHARGE' | 'USAGE' | 'ALL'
}
