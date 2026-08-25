using System;
using System.Collections.Generic;

namespace EcommerceBot.Application.DTOs.Emails
{
    public class EmailEventPayload
    {
        public Guid TenantId { get; set; }
        public string Event { get; set; } = string.Empty;
        public string RecipientEmail { get; set; } = string.Empty;
        public string RecipientName { get; set; } = string.Empty;
        public string? IdempotencyKey { get; set; }
        public Dictionary<string, object> Data { get; set; } = new Dictionary<string, object>();
    }
}
