using System;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Api.Filters;
using EcommerceBot.Application.DTOs.Scraper;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/scraper")]
public class ScraperController : BaseApiController
{
    private readonly IScraperService _scraperService;

    public ScraperController(IScraperService scraperService)
    {
        _scraperService = scraperService;
    }

    [HttpPost("extract")]
    [RateLimit(MaxRequests = 20, WindowSeconds = 60, BlockDurationSeconds = 300)]
    public async Task<IActionResult> Extract(
        [FromBody] WebScraperRequest payload,
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequestProblem("O header X-Tenant-ID é obrigatório.");

        try
        {
            var taskId = await _scraperService.EnqueueExtractionTaskAsync(activeTenantId, payload.Url);

            return Accepted(new
            {
                status = "accepted",
                task_id = taskId,
                message = "Extração iniciada com sucesso em background."
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequestProblem(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return ConflictProblem(ex.Message);
        }
    }
}
