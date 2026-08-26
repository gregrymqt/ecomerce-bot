using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Scraper;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers;

[ApiController]
[Route("api/v1/scraper")]
[Authorize]
public class ScraperController : ControllerBase
{
    private readonly IScraperService _scraperService;

    public ScraperController(IScraperService scraperService)
    {
        _scraperService = scraperService;
    }

    [HttpPost("extract")]
    public async Task<IActionResult> Extract(
        [FromBody] WebScraperRequest payload,
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId)
    {
        if (tenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header is required.");

        try
        {
            var taskId = await _scraperService.EnqueueExtractionTaskAsync(tenantId, payload.Url);

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
