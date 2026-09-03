using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Analytics;

namespace EcommerceBot.Application.Interfaces;

public interface IAiCapacityService
{
    Task<AiCapacityOverviewResponse> GetCapacityOverviewAsync(int horizonDays = 30);
    Task<AiProviderCreditDto> RegisterTopupAsync(AiProviderCreditTopupRequest request);
    Task<bool> TriggerForecastRecalculationAsync();
}
