using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Integrations;

namespace EcommerceBot.Application.Interfaces;

public interface IStoreIntegrationService
{
    Task<IntegrationSummaryDto> GetSummaryAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<IEnumerable<StoreIntegrationResponseDto>> ListIntegrationsAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<HealthCheckResultDto> TestHealthCheckAsync(Guid tenantId, Guid integrationId, CancellationToken cancellationToken = default);
    Task<bool> DisconnectStoreAsync(Guid tenantId, Guid integrationId, CancellationToken cancellationToken = default);
}
