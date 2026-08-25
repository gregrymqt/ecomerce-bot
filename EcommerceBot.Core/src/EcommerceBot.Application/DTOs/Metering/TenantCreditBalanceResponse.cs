using System;

namespace EcommerceBot.Application.DTOs.Metering
{
    public class TenantCreditBalanceResponse
    {
        public string TenantId { get; set; } = string.Empty;
        public decimal ManagedCreditBalance { get; set; }
        public int MonthlyTotalTokens { get; set; }
        public decimal MonthlyTotalCostUsd { get; set; }
        public bool IsByokEnabled { get; set; }
        public string ActiveMode { get; set; } = "managed";
    }
}
