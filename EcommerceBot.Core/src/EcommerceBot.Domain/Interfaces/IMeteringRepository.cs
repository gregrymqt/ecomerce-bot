using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces
{
    public interface IMeteringRepository
    {
        Task<decimal> GetManagedCreditBalanceAsync(Guid tenantId);
        Task<LlmUsageLog> CreateUsageLogAsync(LlmUsageLog log);
        Task<bool> AtomicReserveCreditsAsync(Guid tenantId, decimal estimatedCost);
        Task AtomicRefundCreditsAsync(Guid tenantId, decimal amount);
        Task AtomicSettleCreditsAsync(Guid tenantId, decimal reservedCost, decimal actualCost);
        Task<(int TotalTokens, decimal TotalCost)> GetMonthlyTelemetryAsync(Guid tenantId);
        Task<(IEnumerable<LlmUsageLog> Items, int TotalCount)> GetUsageLogsPaginatedAsync(Guid tenantId, int page, int limit, DateTimeOffset? startDate, DateTimeOffset? endDate);
    }
}
