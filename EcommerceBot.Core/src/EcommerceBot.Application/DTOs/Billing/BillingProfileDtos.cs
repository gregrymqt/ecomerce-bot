using System;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.Billing;

/// <summary>
/// Resposta com os dados fiscais e de endereço de faturamento do Tenant.
/// </summary>
public sealed record TenantBillingProfileResponse
{
    [JsonPropertyName("id")]
    public Guid Id { get; init; }

    [JsonPropertyName("tenant_id")]
    public Guid TenantId { get; init; }

    [JsonPropertyName("legal_name")]
    public string LegalName { get; init; } = string.Empty;

    [JsonPropertyName("trade_name")]
    public string? TradeName { get; init; }

    [JsonPropertyName("document_type")]
    public string DocumentType { get; init; } = "CPF";

    [JsonPropertyName("document_number")]
    public string DocumentNumber { get; init; } = string.Empty;

    [JsonPropertyName("document_number_masked")]
    public string DocumentNumberMasked { get; init; } = string.Empty;

    [JsonPropertyName("email")]
    public string? Email { get; init; }

    [JsonPropertyName("phone")]
    public string? Phone { get; init; }

    [JsonPropertyName("zip_code")]
    public string ZipCode { get; init; } = string.Empty;

    [JsonPropertyName("street_name")]
    public string StreetName { get; init; } = string.Empty;

    [JsonPropertyName("street_number")]
    public string StreetNumber { get; init; } = string.Empty;

    [JsonPropertyName("complement")]
    public string? Complement { get; init; }

    [JsonPropertyName("neighborhood")]
    public string Neighborhood { get; init; } = string.Empty;

    [JsonPropertyName("city")]
    public string City { get; init; } = string.Empty;

    [JsonPropertyName("federal_unit")]
    public string FederalUnit { get; init; } = string.Empty;

    [JsonPropertyName("updated_at")]
    public DateTimeOffset UpdatedAt { get; init; }
}

/// <summary>
/// Requisição para criação ou atualização do perfil de faturamento do Tenant.
/// </summary>
public sealed record UpsertTenantBillingProfileRequest
{
    [Required(ErrorMessage = "O nome completo ou razão social é obrigatório.")]
    [StringLength(255, ErrorMessage = "O nome não pode exceder 255 caracteres.")]
    [JsonPropertyName("legal_name")]
    public string LegalName { get; init; } = string.Empty;

    [StringLength(255)]
    [JsonPropertyName("trade_name")]
    public string? TradeName { get; init; }

    [JsonPropertyName("document_type")]
    public string DocumentType { get; init; } = "CPF";

    [Required(ErrorMessage = "O número do documento (CPF ou CNPJ) é obrigatório.")]
    [StringLength(30)]
    [JsonPropertyName("document_number")]
    public string DocumentNumber { get; init; } = string.Empty;

    [EmailAddress(ErrorMessage = "Informe um e-mail válido para faturamento.")]
    [JsonPropertyName("email")]
    public string? Email { get; init; }

    [StringLength(50)]
    [JsonPropertyName("phone")]
    public string? Phone { get; init; }

    [Required(ErrorMessage = "O CEP é obrigatório.")]
    [StringLength(20)]
    [JsonPropertyName("zip_code")]
    public string ZipCode { get; init; } = string.Empty;

    [Required(ErrorMessage = "O logradouro/rua é obrigatório.")]
    [StringLength(255)]
    [JsonPropertyName("street_name")]
    public string StreetName { get; init; } = string.Empty;

    [Required(ErrorMessage = "O número é obrigatório (use 'S/N' caso não possua).")]
    [StringLength(50)]
    [JsonPropertyName("street_number")]
    public string StreetNumber { get; init; } = string.Empty;

    [StringLength(150)]
    [JsonPropertyName("complement")]
    public string? Complement { get; init; }

    [Required(ErrorMessage = "O bairro é obrigatório.")]
    [StringLength(150)]
    [JsonPropertyName("neighborhood")]
    public string Neighborhood { get; init; } = string.Empty;

    [Required(ErrorMessage = "A cidade é obrigatória.")]
    [StringLength(150)]
    [JsonPropertyName("city")]
    public string City { get; init; } = string.Empty;

    [Required(ErrorMessage = "O estado (UF) é obrigatório.")]
    [StringLength(10)]
    [JsonPropertyName("federal_unit")]
    public string FederalUnit { get; init; } = string.Empty;
}
