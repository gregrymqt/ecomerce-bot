using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Analytics;

namespace EcommerceBot.Application.Interfaces;

/// <summary>
/// Contrato do serviço de orquestração de modelos preditivos de Machine Learning (RFM, Churn e LTV).
/// </summary>
public interface IMachineLearningService
{
    Task<bool> TriggerAnalysisAsync(Guid tenantId, string jobType = "FULL_ANALYTICS");
    Task<MlInsightsResponse?> GetLatestInsightsAsync(Guid tenantId);
}
