using System;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Admin;
using EcommerceBot.Application.DTOs.Auth;

namespace EcommerceBot.Application.Interfaces;

public interface IEnterpriseLeadService
{
    Task<EnterpriseLeadResponse> RegisterLeadAsync(EnterpriseLeadRequest request, string? ipAddress, CancellationToken cancellationToken = default);
    Task<EnterpriseLeadsListResponse> GetLeadsAsync(string? status, string? search, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<bool> UpdateLeadStatusAsync(Guid id, UpdateEnterpriseLeadStatusRequest request, CancellationToken cancellationToken = default);
    Task<ProvisionEnterpriseAccountResponse> ProvisionEnterpriseAccountAsync(Guid leadId, ProvisionEnterpriseAccountRequest request, CancellationToken cancellationToken = default);
}
