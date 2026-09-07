using System;

namespace EcommerceBot.Domain.Entities;

/// <summary>
/// Credenciais e status de conexão com plataformas de e-commerce parceiras com BYOK AES-256 (dbo.StoreIntegrations).
/// </summary>
public sealed class StoreIntegration
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Platform { get; set; } = string.Empty; // 'SHOPIFY', 'NUVEMSHOP', 'WOOCOMMERCE'
    public string StoreDomain { get; set; } = string.Empty;
    public byte[] EncryptedAccessToken { get; set; } = [];
    public byte[]? EncryptedClientSecret { get; set; }
    public byte[] InitializationVector { get; set; } = [];
    public byte[] AuthTag { get; set; } = [];
    public string Status { get; set; } = "CONNECTED"; // 'CONNECTED', 'DISCONNECTED', 'ERROR'
    public string? HealthCheckStatus { get; set; }
    public int? HealthCheckLatencyMs { get; set; }
    public DateTimeOffset? LastHealthCheckAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
