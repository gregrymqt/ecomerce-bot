using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Analytics;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/[controller]")]
public class AnalyticsController : BaseApiController
{
    private readonly IMachineLearningService _mlService;

    public AnalyticsController(IMachineLearningService mlService)
    {
        _mlService = mlService;
    }

    /// <summary>
    /// Dispara assincronamente a execução dos modelos de Machine Learning (RFM, Churn e LTV) via RabbitMQ.
    /// </summary>
    [HttpPost("ml/trigger")]
    public async Task<IActionResult> TriggerMlAnalysis(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromBody] MlTriggerRequest? request)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
        {
            return BadRequest(new { error = "Header X-Tenant-ID obrigatório." });
        }

        var jobType = request?.JobType ?? "FULL_ANALYTICS";
        var success = await _mlService.TriggerAnalysisAsync(activeTenantId, jobType);

        return Ok(new
        {
            status = "ENQUEUED",
            message = "Análise de Machine Learning enfileirada com sucesso.",
            tenantId = activeTenantId,
            jobType = jobType
        });
    }

    /// <summary>
    /// Consulta os últimos resultados processados de RFM, Churn e LTV para o Tenant.
    /// </summary>
    [HttpGet("ml/insights")]
    public async Task<IActionResult> GetMlInsights(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
        {
            return BadRequest(new { error = "Header X-Tenant-ID obrigatório." });
        }

        var insights = await _mlService.GetLatestInsightsAsync(activeTenantId);
        if (insights == null)
        {
            return Ok(new
            {
                status = "PROCESSING",
                message = "Análise em processamento pela primeira vez. Aguarde alguns instantes...",
                tenantId = activeTenantId
            });
        }

        return Ok(insights);
    }
}
