using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

/// <summary>
/// Contrato de persistência Append-Only para trilha de auditoria e conformidade LGPD.
/// </summary>
public interface IAuditRepository
{
    Task CreateAsync(AuditLog auditLog, CancellationToken cancellationToken = default);
    Task<IEnumerable<AuditLog>> GetByTenantAsync(Guid tenantId, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default);
}
