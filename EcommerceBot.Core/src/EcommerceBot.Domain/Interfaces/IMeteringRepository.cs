using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

/// <summary>
/// Contrato de persistência para medição atômica de saldo gerenciado, reserva de créditos e telemetria de tokens LLM.
/// </summary>
public interface IMeteringRepository
{
    Task<decimal> GetManagedCreditBalanceAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<LlmUsageLog> CreateUsageLogAsync(LlmUsageLog log, CancellationToken cancellationToken = default);
    Task<bool> AtomicReserveCreditsAsync(Guid tenantId, decimal estimatedCost, CancellationToken cancellationToken = default);
    Task AtomicRefundCreditsAsync(Guid tenantId, decimal amount, CancellationToken cancellationToken = default);
    Task AtomicSettleCreditsAsync(Guid tenantId, decimal reservedCost, decimal actualCost, CancellationToken cancellationToken = default);
    Task<(int TotalTokens, decimal TotalCost)> GetMonthlyTelemetryAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<(IEnumerable<LlmUsageLog> Items, int TotalCount)> GetUsageLogsPaginatedAsync(Guid tenantId, int page, int limit, DateTimeOffset? startDate, DateTimeOffset? endDate, CancellationToken cancellationToken = default);
}
