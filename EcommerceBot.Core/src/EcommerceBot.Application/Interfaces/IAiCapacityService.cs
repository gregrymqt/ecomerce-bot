using System;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Analytics;

namespace EcommerceBot.Application.Interfaces;

public interface IAiCapacityService
{
    Task<AiCapacityOverviewResponse> GetCapacityOverviewAsync(int horizonDays = 30, CancellationToken cancellationToken = default);
    Task<AiProviderCreditDto> RegisterTopupAsync(AiProviderCreditTopupRequest request, CancellationToken cancellationToken = default);
    Task<bool> TriggerForecastRecalculationAsync(CancellationToken cancellationToken = default);
}
