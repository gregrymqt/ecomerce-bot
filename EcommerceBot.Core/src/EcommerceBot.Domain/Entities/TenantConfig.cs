using System;

namespace EcommerceBot.Domain.Entities;

/// <summary>
/// Configurações operacionais serializadas em JSON de tom de voz, precificação e perfil da loja (dbo.TenantConfigs).
/// </summary>
public sealed class TenantConfig
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string? AiSettingsJson { get; set; }
    public string? PricingSettingsJson { get; set; }
    public string? StoreProfileJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
