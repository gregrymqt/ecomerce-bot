using System;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Billing;

namespace EcommerceBot.Application.Interfaces;

/// <summary>
/// Serviço de aplicação para gestão do perfil de faturamento e dados fiscais do Tenant.
/// </summary>
public interface ITenantBillingProfileService
{
    /// <summary>
    /// Recupera o perfil de faturamento do Tenant caso exista.
    /// </summary>
    Task<TenantBillingProfileResponse?> GetProfileAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Cadastra ou atualiza o perfil de faturamento do Tenant com validação de CPF/CNPJ.
    /// </summary>
    Task<TenantBillingProfileResponse> UpsertProfileAsync(Guid tenantId, UpsertTenantBillingProfileRequest request, CancellationToken cancellationToken = default);
}
