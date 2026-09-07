using System;

namespace EcommerceBot.Domain.Entities;

/// <summary>
/// Registro de visita e navegação web no portal SaaS para análise de funil e atribuição de tráfego (dbo.SaasTrafficVisits).
/// </summary>
public sealed class SaasTrafficVisit
{
    public Guid Id { get; set; }
    public string SessionId { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public string? UtmSource { get; set; }
    public string? UtmMedium { get; set; }
    public string? UtmCampaign { get; set; }
    public string? UtmContent { get; set; }
    public string? UtmTerm { get; set; }
    public string? AdId { get; set; }
    public string? FbClid { get; set; }
    public string? GClid { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? Referrer { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
