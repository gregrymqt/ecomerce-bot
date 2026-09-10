using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Application.Interfaces;

/// <summary>
/// Contrato do serviço de auditoria imutável, rastreabilidade de eventos e conformidade LGPD.
/// </summary>
public interface IAuditService
{
    Task LogEventAsync(
        string action,
        string entityName,
        string? entityId = null,
        string? oldValuesJson = null,
        string? newValuesJson = null,
        CancellationToken cancellationToken = default);

    Task<IEnumerable<AuditLog>> GetAuditTrailAsync(
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default);

    Task ExecuteRightToBeForgottenAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default);
}
