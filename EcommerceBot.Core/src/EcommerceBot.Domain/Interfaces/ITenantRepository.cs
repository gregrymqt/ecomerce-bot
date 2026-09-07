using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

public interface ITenantRepository
{
    Task<Tenant?> GetByIdAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<Tenant?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default);
    Task<bool> HasCreditsAsync(Guid tenantId, int requiredCredits = 1, CancellationToken cancellationToken = default);
    Task<int> DeductCreditsAsync(Guid tenantId, int amount, string type = "PRODUCT_ENRICHMENT", string description = "Consumo de créditos de IA", string? referenceId = null, Guid? orderId = null, CancellationToken cancellationToken = default);
    Task<int> AddCreditsAsync(Guid tenantId, int amount, string type = "RECHARGE", string description = "Adição de créditos", string? referenceId = null, Guid? orderId = null, CancellationToken cancellationToken = default);
    Task<int> ReverseCreditsAsync(Guid tenantId, int amount, string type = "CHARGEBACK_REVERSAL", string description = "Estorno / Chargeback de créditos", string? referenceId = null, Guid? orderId = null, CancellationToken cancellationToken = default);
    Task<IEnumerable<CreditTransaction>> GetCreditTransactionsAsync(Guid tenantId, int limit = 50, int offset = 0, string? type = null, CancellationToken cancellationToken = default);
    Task<int> CountCreditTransactionsAsync(Guid tenantId, string? type = null, CancellationToken cancellationToken = default);
    Task RecordTransactionAsync(CreditTransaction transaction, CancellationToken cancellationToken = default);
    Task AddManagedBalanceAsync(Guid tenantId, decimal amount, CancellationToken cancellationToken = default);
    Task<Tenant> CreateAsync(Tenant tenant, CancellationToken cancellationToken = default);
}
