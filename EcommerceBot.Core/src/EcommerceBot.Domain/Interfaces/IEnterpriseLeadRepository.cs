using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces
{
    public interface IEnterpriseLeadRepository
    {
        Task<EnterpriseLead?> GetByIdAsync(Guid id);
        Task<EnterpriseLead?> GetByEmailAsync(string email);
        Task<EnterpriseLead> CreateAsync(EnterpriseLead lead);
        Task<(List<EnterpriseLead> Leads, int TotalCount)> GetAllAsync(string? status, string? search, int page, int pageSize);
        Task<Dictionary<string, int>> GetMetricsAsync();
        Task<bool> UpdateStatusAsync(Guid id, string status, string? internalNotes);
        Task<bool> MarkConvertedAsync(Guid id, Guid tenantId, Guid userId, string? internalNotes);
    }
}
