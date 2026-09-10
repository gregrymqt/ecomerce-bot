using System;

namespace EcommerceBot.Domain.Entities;

/// <summary>
/// Trilha de auditoria imutável (Append-Only) para eventos de autenticação, mutações de segurança,
/// rotação de chaves BYOK e governança LGPD/SOC 2 (dbo.AuditLogs).
/// </summary>
public sealed class AuditLog
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid? UserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityName { get; set; } = string.Empty;
    public string? EntityId { get; set; }
    public string? OldValuesJson { get; set; }
    public string? NewValuesJson { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
