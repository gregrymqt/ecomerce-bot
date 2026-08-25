using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Metering;

namespace EcommerceBot.Application.Interfaces
{
    public interface IMeteringService
    {
        Task<TenantCreditBalanceResponse> GetTenantCreditBalanceAsync(Guid tenantId);
        
        Task<PaginatedLlmUsageLogResponse> GetTenantUsageLogsAsync(
            Guid tenantId, 
            int page, 
            int limit, 
            DateTimeOffset? startDate, 
            DateTimeOffset? endDate);

        decimal CalculateTokenCost(string modelUsed, int promptTokens, int completionTokens);

        Task<decimal> ReserveCreditsForLlmAsync(Guid tenantId, ReserveCreditsRequest request);
        
        Task RefundCreditsOnFailureAsync(Guid tenantId, decimal reservedCost);
        
        Task<LlmUsageLogResponse> RecordUsageAndDeductAsync(Guid tenantId, LlmUsageLogCreate request);
    }
}
