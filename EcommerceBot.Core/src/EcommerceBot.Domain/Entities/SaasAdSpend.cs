using System;

namespace EcommerceBot.Domain.Entities;

public class SaasAdSpend
{
    public Guid Id { get; set; }
    public string CampaignName { get; set; } = string.Empty;
    public string UtmSource { get; set; } = "meta_ads";
    public string? AdId { get; set; }
    public decimal AmountSpentBrl { get; set; }
    public DateTimeOffset PeriodStart { get; set; }
    public DateTimeOffset PeriodEnd { get; set; }
    public string? Notes { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
