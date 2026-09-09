using System;

namespace EcommerceBot.Domain.Entities;

/// <summary>
/// Perfil fiscal e endereço de faturamento do Tenant para pagamentos e checkout (dbo.TenantBillingProfiles).
/// </summary>
public sealed class TenantBillingProfile
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string LegalName { get; set; } = string.Empty;
    public string? TradeName { get; set; }
    public string DocumentType { get; set; } = "CPF"; // CPF ou CNPJ
    public string DocumentNumber { get; set; } = string.Empty; // Apenas números
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string ZipCode { get; set; } = string.Empty;
    public string StreetName { get; set; } = string.Empty;
    public string StreetNumber { get; set; } = string.Empty;
    public string? Complement { get; set; }
    public string Neighborhood { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string FederalUnit { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
