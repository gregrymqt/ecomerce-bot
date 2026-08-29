using System;

namespace EcommerceBot.Domain.Entities
{
    public class EnterpriseLead
    {
        public Guid Id { get; set; }
        public string Email { get; set; } = string.Empty;
        public string? CompanyName { get; set; }
        public string? JobTitle { get; set; }
        public string? ExpectedVolume { get; set; }
        public string? Phone { get; set; }
        public string? TeamSize { get; set; }
        public string? Notes { get; set; }
        public string Status { get; set; } = "PENDING";
        public string? InternalNotes { get; set; }
        public Guid? ConvertedTenantId { get; set; }
        public Guid? ConvertedUserId { get; set; }
        public string? IpAddress { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }
}
