using System;

namespace EcommerceBot.Domain.Entities;

public class TenantAiCredential
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Provider { get; set; } = string.Empty; // e.g. OpenRouter, Shopify
    public byte[] EncryptedApiKey { get; set; } = Array.Empty<byte>();
    public byte[] InitializationVector { get; set; } = Array.Empty<byte>();
    public byte[] AuthTag { get; set; } = Array.Empty<byte>();
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
