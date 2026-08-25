using System;
using EcommerceBot.Application.Interfaces;

namespace EcommerceBot.Api.Services;

public class TenantContext : ITenantContext
{
    public Guid TenantId { get; private set; }
    public bool HasTenant => TenantId != Guid.Empty;

    public void SetTenantId(Guid tenantId)
    {
        if (HasTenant)
        {
            throw new InvalidOperationException("TenantId is already set for this context.");
        }
        TenantId = tenantId;
    }
}
