using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.Wallet;

public class WalletBalanceResponseDto
{
    [JsonPropertyName("tenant_id")]
    public Guid TenantId { get; set; }

    [JsonPropertyName("balance_credits")]
    public int BalanceCredits { get; set; }

    [JsonPropertyName("managed_credit_balance")]
    public decimal ManagedCreditBalance { get; set; }

    [JsonPropertyName("updated_at")]
    public DateTimeOffset UpdatedAt { get; set; }
}

public class CreditTransactionDto
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("tenant_id")]
    public Guid TenantId { get; set; }

    [JsonPropertyName("amount")]
    public decimal Amount { get; set; }

    [JsonPropertyName("type")]
    public string Type { get; set; } = "RECHARGE"; // 'RECHARGE' | 'USAGE'

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("external_payment_id")]
    public string? ExternalPaymentId { get; set; }

    [JsonPropertyName("created_at")]
    public DateTimeOffset CreatedAt { get; set; }
}

public class WalletStatementResponseDto
{
    [JsonPropertyName("balance_credits")]
    public int BalanceCredits { get; set; }

    [JsonPropertyName("managed_credit_balance")]
    public decimal ManagedCreditBalance { get; set; }

    [JsonPropertyName("transactions")]
    public List<CreditTransactionDto> Transactions { get; set; } = new();

    [JsonPropertyName("total_count")]
    public int TotalCount { get; set; }
}

public class RechargeRequestDto
{
    [JsonPropertyName("credits_package")]
    public int CreditsPackage { get; set; }

    [JsonPropertyName("package_id")]
    public string? PackageId { get; set; }

    [JsonPropertyName("amount")]
    public decimal Amount { get; set; }

    [JsonPropertyName("payment_method")]
    public string PaymentMethod { get; set; } = "pix"; // 'pix' | 'credit_card'

    [JsonPropertyName("card_token")]
    public string? CardToken { get; set; }

    [JsonPropertyName("payment_method_id")]
    public string? PaymentMethodId { get; set; }

    [JsonPropertyName("installments")]
    public int Installments { get; set; } = 1;

    [JsonPropertyName("payer_email")]
    public string? PayerEmail { get; set; }

    [JsonPropertyName("payer")]
    public CardPaymentPayerDto? Payer { get; set; }
}

public class CardPaymentPayerDto
{
    [JsonPropertyName("email")]
    public string? Email { get; set; }

    [JsonPropertyName("identification")]
    public IdentificationDto? Identification { get; set; }
}

public class IdentificationDto
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = "CPF";

    [JsonPropertyName("number")]
    public string Number { get; set; } = string.Empty;
}

public class RechargeResponseDto
{
    [JsonPropertyName("payment_id")]
    public string PaymentId { get; set; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; set; } = "pending";

    [JsonPropertyName("pix_qr_code")]
    public string? PixQrCode { get; set; }

    [JsonPropertyName("pix_copia_e_cola")]
    public string? PixCopiaECola { get; set; }

    [JsonPropertyName("expiration_date")]
    public string? ExpirationDate { get; set; }
}

public class StatementFiltersDto
{
    public int Page { get; set; } = 1;
    public int Limit { get; set; } = 20;
    public string? Type { get; set; } // 'RECHARGE' | 'USAGE' | 'ALL'
}
