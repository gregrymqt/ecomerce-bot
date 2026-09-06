using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

public interface ITenantRepository
{
    Task<Tenant?> GetByIdAsync(Guid tenantId);
    Task<Tenant?> GetBySlugAsync(string slug);
    Task<bool> HasCreditsAsync(Guid tenantId, int requiredCredits = 1);
    Task<int> DeductCreditsAsync(Guid tenantId, int amount, string type = "PRODUCT_ENRICHMENT", string description = "Consumo de créditos de IA", string? referenceId = null, Guid? orderId = null);
    Task<int> AddCreditsAsync(Guid tenantId, int amount, string type = "RECHARGE", string description = "Adição de créditos", string? referenceId = null, Guid? orderId = null);
    Task<IEnumerable<CreditTransaction>> GetCreditTransactionsAsync(Guid tenantId, int limit = 50, int offset = 0, string? type = null);
    Task<int> CountCreditTransactionsAsync(Guid tenantId, string? type = null);
    Task RecordTransactionAsync(CreditTransaction transaction);
    Task AddManagedBalanceAsync(Guid tenantId, decimal amount);
    Task<Tenant> CreateAsync(Tenant tenant);
}
