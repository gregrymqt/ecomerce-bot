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
        public string? IpAddress { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
    }
}
