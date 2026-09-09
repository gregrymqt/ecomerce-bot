using System;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

public interface ITenantAiCredentialRepository
{
    Task<TenantAiCredential?> GetByProviderAsync(Guid tenantId, string provider, CancellationToken cancellationToken = default);
    Task<bool> HasActiveByokAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task UpsertAsync(TenantAiCredential credential, CancellationToken cancellationToken = default);
}
