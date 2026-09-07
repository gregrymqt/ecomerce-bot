using System;

namespace EcommerceBot.Domain.Entities;

/// <summary>
/// Modelo de atribuição de tráfego e conversão com parâmetros UTM e IDs de clique (dbo.TrafficAttributions).
/// </summary>
public sealed class TrafficAttribution
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid? OrderId { get; set; }
    public string SessionId { get; set; } = string.Empty;
    public string? UtmSource { get; set; }
    public string? UtmMedium { get; set; }
    public string? UtmCampaign { get; set; }
    public string? UtmTerm { get; set; }
    public string? UtmContent { get; set; }
    public string? AdId { get; set; }
    public string? FbClid { get; set; }
    public string? GClid { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
