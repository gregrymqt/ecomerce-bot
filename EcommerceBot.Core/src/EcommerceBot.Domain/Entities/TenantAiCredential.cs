using System;

namespace EcommerceBot.Domain.Entities;

/// <summary>
/// Chave de API de IA própria do lojista (Bring Your Own Key - BYOK) criptografada via AES-256 GCM (dbo.TenantAiCredentials).
/// </summary>
public sealed class TenantAiCredential
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Provider { get; set; } = string.Empty; // e.g. OpenRouter, OpenAI
    public byte[] EncryptedApiKey { get; set; } = [];
    public byte[] InitializationVector { get; set; } = [];
    public byte[] AuthTag { get; set; } = [];
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
