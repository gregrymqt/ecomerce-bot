using System;
using System.Net;
using System.Net.Sockets;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Scraper;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers;

[ApiController]
[Route("api/v1/scraper")]
[Authorize]
public class ScraperController : ControllerBase
{
    private readonly IScraperService _scraperService;
    private readonly ITenantRepository _tenantRepository;

    public ScraperController(IScraperService scraperService, ITenantRepository tenantRepository)
    {
        _scraperService = scraperService;
        _tenantRepository = tenantRepository;
    }

    private static bool IsSafePublicUrl(string urlString)
    {
        if (!Uri.TryCreate(urlString, UriKind.Absolute, out var uri))
            return false;

        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            return false;

        var host = uri.DnsSafeHost.ToLowerInvariant();
        if (host == "localhost" || host.EndsWith(".localhost") || host.EndsWith(".local"))
            return false;

        if (IPAddress.TryParse(host, out var ip))
        {
            if (IPAddress.IsLoopback(ip)) return false;

            var bytes = ip.GetAddressBytes();
            if (ip.AddressFamily == AddressFamily.InterNetwork)
            {
                // 10.0.0.0/8
                if (bytes[0] == 10) return false;
                // 172.16.0.0/12
                if (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) return false;
                // 192.168.0.0/16
                if (bytes[0] == 192 && bytes[1] == 168) return false;
                // 169.254.0.0/16 (Link Local / Cloud Metadata)
                if (bytes[0] == 169 && bytes[1] == 254) return false;
                // 0.0.0.0
                if (bytes[0] == 0) return false;
            }
        }

        return true;
    }

    [HttpPost("extract")]
    public async Task<IActionResult> Extract(
        [FromBody] WebScraperRequest payload,
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId)
    {
        if (tenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header is required.");

        if (string.IsNullOrWhiteSpace(payload.Url) || !IsSafePublicUrl(payload.Url))
            return BadRequest(new { detail = "URL inválida ou bloqueada por política de segurança Anti-SSRF." });

        var tenant = await _tenantRepository.GetByIdAsync(tenantId);
        var plan = tenant?.PlanTier ?? "free";

        try
        {
            var taskId = await _scraperService.EnqueueExtractionTaskAsync(tenantId, payload.Url, plan);
            
            return Accepted(new
            {
                status = "accepted",
                task_id = taskId,
                message = "Extração iniciada com sucesso em background."
            });
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
