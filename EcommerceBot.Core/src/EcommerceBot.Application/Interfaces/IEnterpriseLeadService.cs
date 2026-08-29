using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Admin;
using EcommerceBot.Application.DTOs.Auth;

namespace EcommerceBot.Application.Interfaces
{
    public interface IEnterpriseLeadService
    {
        Task<EnterpriseLeadResponse> RegisterLeadAsync(EnterpriseLeadRequest request, string? ipAddress);
        Task<EnterpriseLeadsListResponse> GetLeadsAsync(string? status, string? search, int page, int pageSize);
        Task<bool> UpdateLeadStatusAsync(Guid id, UpdateEnterpriseLeadStatusRequest request);
        Task<ProvisionEnterpriseAccountResponse> ProvisionEnterpriseAccountAsync(Guid leadId, ProvisionEnterpriseAccountRequest request);
    }
}
