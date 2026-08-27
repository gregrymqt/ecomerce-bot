using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Integrations;

namespace EcommerceBot.Application.Interfaces;

public interface IStoreIntegrationService
{
    Task<IntegrationSummaryDto> GetSummaryAsync(Guid tenantId);
    Task<IEnumerable<StoreIntegrationResponseDto>> ListIntegrationsAsync(Guid tenantId);
    Task<HealthCheckResultDto> TestHealthCheckAsync(Guid tenantId, Guid integrationId);
    Task<bool> DisconnectStoreAsync(Guid tenantId, Guid integrationId);
}
