using System;

namespace EcommerceBot.Domain.Entities;

public class StoreIntegration
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Platform { get; set; } = string.Empty; // 'SHOPIFY', 'NUVEMSHOP', 'WOOCOMMERCE'
    public string StoreDomain { get; set; } = string.Empty;
    public byte[] EncryptedAccessToken { get; set; } = Array.Empty<byte>();
    public byte[]? EncryptedClientSecret { get; set; }
    public byte[] InitializationVector { get; set; } = Array.Empty<byte>();
    public byte[] AuthTag { get; set; } = Array.Empty<byte>();
    public string Status { get; set; } = "CONNECTED"; // 'CONNECTED', 'DISCONNECTED', 'ERROR'
    public string? HealthCheckStatus { get; set; }
    public int? HealthCheckLatencyMs { get; set; }
    public DateTimeOffset? LastHealthCheckAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
