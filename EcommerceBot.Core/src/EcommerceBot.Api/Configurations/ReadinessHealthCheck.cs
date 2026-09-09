using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.Interfaces;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace EcommerceBot.Api.Configurations;

/// <summary>
/// Sonda de prontidão (Readiness Probe) que valida ativamente as dependências vitais (SQL Server e Redis)
/// antes de direcionar tráfego para a API, em conformidade com a Seção 8.3 do SKILL.md.
/// </summary>
public class ReadinessHealthCheck : IHealthCheck
{
    private readonly ISystemService _systemService;

    public ReadinessHealthCheck(ISystemService systemService)
    {
        _systemService = systemService;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var health = await _systemService.CheckSystemHealthAsync(cancellationToken);
        var data = health.Services.ToDictionary(k => k.Key, v => (object)v.Value);

        return string.Equals(health.Status, "OK", System.StringComparison.OrdinalIgnoreCase)
            ? HealthCheckResult.Healthy("SQL Server e Redis operacionais.", data)
            : HealthCheckResult.Degraded("Uma ou mais dependências essenciais estão degradadas.", null, data);
    }
}
