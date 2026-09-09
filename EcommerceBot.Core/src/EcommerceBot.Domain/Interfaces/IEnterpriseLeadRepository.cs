using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

/// <summary>
/// Contrato de persistência para captação, qualificação e conversão de leads corporativos SaaS.
/// </summary>
public interface IEnterpriseLeadRepository
{
    Task<EnterpriseLead?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<EnterpriseLead?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);
    Task<EnterpriseLead> CreateAsync(EnterpriseLead lead, CancellationToken cancellationToken = default);
    Task<(List<EnterpriseLead> Leads, int TotalCount)> GetAllAsync(string? status, string? search, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<Dictionary<string, int>> GetMetricsAsync(CancellationToken cancellationToken = default);
    Task<bool> UpdateStatusAsync(Guid id, string status, string? internalNotes, CancellationToken cancellationToken = default);
    Task<bool> MarkConvertedAsync(Guid id, Guid tenantId, Guid userId, string? internalNotes, CancellationToken cancellationToken = default);
}
