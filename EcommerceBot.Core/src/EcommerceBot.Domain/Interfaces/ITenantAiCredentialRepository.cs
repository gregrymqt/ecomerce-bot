using System;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

public interface ITenantAiCredentialRepository
{
    Task<TenantAiCredential?> GetByProviderAsync(Guid tenantId, string provider);
    Task UpsertAsync(TenantAiCredential credential);
}
