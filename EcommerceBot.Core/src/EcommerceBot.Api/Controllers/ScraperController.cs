using System;
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
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header is required.");

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
            return BadRequest(new { detail = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { detail = "Erro interno ao enfileirar extração.", error = ex.Message });
        }
    }
}
