using System;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

/// <summary>
/// Contrato de persistência para perfis de faturamento multi-tenant (dbo.TenantBillingProfiles).
/// </summary>
public interface ITenantBillingProfileRepository
{
    /// <summary>
    /// Obtém o perfil de faturamento do Tenant.
    /// </summary>
    Task<TenantBillingProfile?> GetByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Insere ou atualiza o perfil de faturamento do Tenant (Upsert idempotente).
    /// </summary>
    Task<TenantBillingProfile> UpsertAsync(TenantBillingProfile profile, CancellationToken cancellationToken = default);
}
