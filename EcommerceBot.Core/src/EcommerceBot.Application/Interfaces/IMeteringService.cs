using System;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Metering;

namespace EcommerceBot.Application.Interfaces;

public interface IMeteringService
{
    Task<TenantCreditBalanceResponse> GetTenantCreditBalanceAsync(Guid tenantId, CancellationToken cancellationToken = default);
    
    Task<PaginatedLlmUsageLogResponse> GetTenantUsageLogsAsync(
        Guid tenantId, 
        int page, 
        int limit, 
        DateTimeOffset? startDate, 
        DateTimeOffset? endDate,
        CancellationToken cancellationToken = default);

    decimal CalculateTokenCost(string modelUsed, int promptTokens, int completionTokens);

    Task<decimal> ReserveCreditsForLlmAsync(Guid tenantId, ReserveCreditsRequest request, CancellationToken cancellationToken = default);
    
    Task RefundCreditsOnFailureAsync(Guid tenantId, decimal reservedCost, CancellationToken cancellationToken = default);
    
    Task<LlmUsageLogResponse> RecordUsageAndDeductAsync(Guid tenantId, LlmUsageLogCreate request, CancellationToken cancellationToken = default);
}
