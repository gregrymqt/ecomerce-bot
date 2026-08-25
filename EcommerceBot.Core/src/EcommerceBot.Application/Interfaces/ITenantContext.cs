using System;

namespace EcommerceBot.Application.Interfaces;

public interface ITenantContext
{
    Guid TenantId { get; }
    bool HasTenant { get; }
    void SetTenantId(Guid tenantId);
}
