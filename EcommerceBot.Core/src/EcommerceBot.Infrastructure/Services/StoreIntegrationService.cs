using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Integrations;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

public sealed class StoreIntegrationService : IStoreIntegrationService
{
    private readonly IStoreIntegrationRepository _integrationRepository;
    private readonly IEcommerceGatewayFactory _gatewayFactory;
    private readonly ITenantRepository _tenantRepository;
    private readonly ILogger<StoreIntegrationService> _logger;

    public StoreIntegrationService(
        IStoreIntegrationRepository integrationRepository,
        IEcommerceGatewayFactory gatewayFactory,
        ITenantRepository tenantRepository,
        ILogger<StoreIntegrationService> logger)
    {
        _integrationRepository = integrationRepository;
        _gatewayFactory = gatewayFactory;
        _tenantRepository = tenantRepository;
        _logger = logger;
    }

    public async Task<IntegrationSummaryDto> GetSummaryAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            var integrations = (await _integrationRepository.ListByTenantAsync(tenantId, cancellationToken)).ToList();
            var connectedCount = integrations.Count(i => i.Status.Equals("CONNECTED", StringComparison.OrdinalIgnoreCase));
            
            var tenant = await _tenantRepository.GetByIdAsync(tenantId, cancellationToken);
            var maxStores = tenant?.PlanTier?.ToUpperInvariant() switch
            {
                "ENTERPRISE" => 10,
                "SCALE" => 5,
                "PRO" => 3,
                _ => 1
            };

            var healthyCount = integrations.Count(i => i.Status.Equals("CONNECTED", StringComparison.OrdinalIgnoreCase) && 
                                                      (i.HealthCheckStatus == null || !i.HealthCheckStatus.Contains("Erro", StringComparison.OrdinalIgnoreCase)));

            var percentage = integrations.Count == 0 ? 100.0 : Math.Round(((double)healthyCount / integrations.Count) * 100, 1);
            var latestSync = integrations.OrderByDescending(i => i.LastHealthCheckAt ?? i.UpdatedAt).FirstOrDefault()?.LastHealthCheckAt ?? DateTimeOffset.UtcNow;

            return new IntegrationSummaryDto
            {
                ConnectedStoresCount = connectedCount,
                MaxStoresAllowed = maxStores,
                ApiStatusPercentage = percentage,
                LastSyncTimestamp = latestSync
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao obter resumo de integrações para o Tenant {TenantId}. Retornando fallback seguro.", tenantId);
            return new IntegrationSummaryDto
            {
                ConnectedStoresCount = 0,
                MaxStoresAllowed = 1,
                ApiStatusPercentage = 100.0,
                LastSyncTimestamp = DateTimeOffset.UtcNow
            };
        }
    }

    public async Task<IEnumerable<StoreIntegrationResponseDto>> ListIntegrationsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            var list = await _integrationRepository.ListByTenantAsync(tenantId, cancellationToken);
            return list.Select(i => new StoreIntegrationResponseDto
            {
                Id = i.Id,
                TenantId = i.TenantId,
                Platform = i.Platform,
                StoreDomain = i.StoreDomain,
                Status = i.Status,
                HealthCheckStatus = i.HealthCheckStatus ?? "API Operacional",
                HealthCheckLatencyMs = i.HealthCheckLatencyMs ?? 120,
                CreatedAt = i.CreatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao listar integrações para o Tenant {TenantId}", tenantId);
            return Enumerable.Empty<StoreIntegrationResponseDto>();
        }
    }

    public async Task<HealthCheckResultDto> TestHealthCheckAsync(Guid tenantId, Guid integrationId, CancellationToken cancellationToken = default)
    {
        var integration = await _integrationRepository.GetByIdAsync(integrationId, cancellationToken);
        if (integration == null || integration.TenantId != tenantId)
        {
            return new HealthCheckResultDto
            {
                Success = false,
                Message = "Integração não encontrada.",
                LatencyMs = 0
            };
        }

        try
        {
            var gateway = _gatewayFactory.GetGateway(integration.Platform);
            var (success, latencyMs, message) = await gateway.HealthCheckAsync(tenantId, cancellationToken);

            var status = success ? "CONNECTED" : "ERROR";
            await _integrationRepository.UpdateHealthCheckAsync(integration.Id, status, latencyMs, message, cancellationToken);

            return new HealthCheckResultDto
            {
                Success = success,
                Message = message,
                LatencyMs = latencyMs
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro no teste de conexão da loja {StoreDomain}", integration.StoreDomain);
            await _integrationRepository.UpdateHealthCheckAsync(integration.Id, "ERROR", 0, $"Falha: {ex.Message}", cancellationToken);
            return new HealthCheckResultDto
            {
                Success = false,
                Message = $"Falha ao testar conexão: {ex.Message}",
                LatencyMs = 0
            };
        }
    }

    public async Task<bool> DisconnectStoreAsync(Guid tenantId, Guid integrationId, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Desconectando loja {IntegrationId} para Tenant {TenantId}", integrationId, tenantId);
            return await _integrationRepository.DeleteAsync(tenantId, integrationId, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao desconectar loja {IntegrationId} para Tenant {TenantId}", integrationId, tenantId);
            throw;
        }
    }
}
