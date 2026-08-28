using System;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Metering;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Infrastructure.Options;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/[controller]")]
public class MeteringController : BaseApiController
{
    private readonly IMeteringService _meteringService;
    private readonly SecurityOptions _securityOptions;

    public MeteringController(IMeteringService meteringService, IOptions<SecurityOptions> securityOptions)
    {
        _meteringService = meteringService;
        _securityOptions = securityOptions.Value;
    }

    private bool IsAuthorizedInternalService()
    {
        var internalKey = _securityOptions.InternalServiceKey;
        if (!string.IsNullOrEmpty(internalKey))
        {
            if (Request.Headers.TryGetValue("X-Internal-Secret", out var providedKey) &&
                CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(providedKey.ToString()),
                    Encoding.UTF8.GetBytes(internalKey)))
            {
                return true;
            }
        }

        if (User.Identity?.IsAuthenticated == true && (IsAdmin || IsSystem))
        {
            return true;
        }

        return false;
    }

    [HttpGet("balance")]
    public async Task<IActionResult> GetBalance()
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty)
            return BadRequest(new { detail = "X-Tenant-ID header is missing or invalid." });

        var result = await _meteringService.GetTenantCreditBalanceAsync(tenantId);
        return Ok(result);
    }

    [HttpGet("usage")]
    public async Task<IActionResult> GetUsageLogs([FromQuery] int page = 1, [FromQuery] int limit = 20, [FromQuery] DateTimeOffset? startDate = null, [FromQuery] DateTimeOffset? endDate = null)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty)
            return BadRequest(new { detail = "X-Tenant-ID header is missing or invalid." });

        var result = await _meteringService.GetTenantUsageLogsAsync(tenantId, page, limit, startDate, endDate);
        return Ok(result);
    }

    [HttpPost("internal/reserve")]
    [AllowAnonymous]
    public async Task<IActionResult> ReserveCredits([FromHeader(Name = "X-Tenant-ID")] Guid tenantId, [FromBody] ReserveCreditsRequest request)
    {
        if (!IsAuthorizedInternalService())
            return Unauthorized(new { detail = "Acesso restrito a serviços internos ou administradores." });

        try
        {
            var reservedCost = await _meteringService.ReserveCreditsForLlmAsync(tenantId, request);
            return Ok(new { reserved_cost = reservedCost });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }
    }

    [HttpPost("internal/refund")]
    [AllowAnonymous]
    public async Task<IActionResult> RefundCredits([FromHeader(Name = "X-Tenant-ID")] Guid tenantId, [FromBody] RefundCreditsRequest request)
    {
        if (!IsAuthorizedInternalService())
            return Unauthorized(new { detail = "Acesso restrito a serviços internos ou administradores." });

        await _meteringService.RefundCreditsOnFailureAsync(tenantId, request.ReservedCost);
        return Ok();
    }

    [HttpPost("internal/record")]
    [AllowAnonymous]
    public async Task<IActionResult> RecordUsage([FromHeader(Name = "X-Tenant-ID")] Guid tenantId, [FromBody] LlmUsageLogCreate request)
    {
        if (!IsAuthorizedInternalService())
            return Unauthorized(new { detail = "Acesso restrito a serviços internos ou administradores." });

        var result = await _meteringService.RecordUsageAndDeductAsync(tenantId, request);
        return Ok(result);
    }
}
