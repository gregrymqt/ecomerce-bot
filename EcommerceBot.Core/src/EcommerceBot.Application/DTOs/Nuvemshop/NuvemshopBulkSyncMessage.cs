using System;
using System.Collections.Generic;

namespace EcommerceBot.Application.DTOs.Nuvemshop
{
    public class NuvemshopBulkSyncMessage
    {
        public string JobId { get; set; } = string.Empty;
        public Guid TenantId { get; set; }
        public string Sku { get; set; } = string.Empty;
        public bool ForceUpdate { get; set; }
        public string Visibility { get; set; } = "visible";
    }

    public class NuvemshopBulkSyncRequest
    {
        public List<string> Skus { get; set; } = new();
        public bool ForceUpdate { get; set; }
        public string Visibility { get; set; } = "visible";
    }
}
