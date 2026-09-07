using System;

namespace EcommerceBot.Domain.Entities;

/// <summary>
/// Trilha de auditoria e status de entrega de notificações transacionais por e-mail (dbo.EmailLogs).
/// </summary>
public sealed class EmailLog
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string? ResendId { get; set; }
    public string Recipient { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public string Status { get; set; } = "PENDING";
    public string Subject { get; set; } = string.Empty;
    public string? IdempotencyKey { get; set; }
    public string? ErrorMessage { get; set; }
    public string MetadataInfo { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
