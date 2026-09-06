using System;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

public interface ITenantAiCredentialRepository
{
    Task<TenantAiCredential?> GetByProviderAsync(Guid tenantId, string provider);
    Task<bool> HasActiveByokAsync(Guid tenantId);
    Task UpsertAsync(TenantAiCredential credential);
}
