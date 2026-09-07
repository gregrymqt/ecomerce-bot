using System;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Metering;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Infrastructure.Options;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/[controller]")]
public class MeteringController : BaseApiController
{
    private readonly IMeteringService _meteringService;
    private readonly SecurityOptions _securityOptions;
    private readonly ILogger<MeteringController> _logger;

    public MeteringController(
        IMeteringService meteringService,
        IOptions<SecurityOptions> securityOptions,
        ILogger<MeteringController> logger)
    {
        _meteringService = meteringService;
        _securityOptions = securityOptions.Value;
        _logger = logger;
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
    [ProducesResponseType(typeof(TenantCreditBalanceResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetBalance(CancellationToken cancellationToken = default)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty)
        {
            return BadRequestProblem("X-Tenant-ID header is missing or invalid.");
        }

        var result = await _meteringService.GetTenantCreditBalanceAsync(tenantId);
        return Ok(result);
    }

    [HttpGet("usage")]
    [ProducesResponseType(typeof(PaginatedLlmUsageLogResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetUsageLogs(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        [FromQuery] DateTimeOffset? startDate = null,
        [FromQuery] DateTimeOffset? endDate = null,
        CancellationToken cancellationToken = default)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty)
        {
            return BadRequestProblem("X-Tenant-ID header is missing or invalid.");
        }

        var result = await _meteringService.GetTenantUsageLogsAsync(tenantId, page, limit, startDate, endDate);
        return Ok(result);
    }

    [HttpPost("internal/reserve")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ReserveCredits(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromBody] ReserveCreditsRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!IsAuthorizedInternalService())
        {
            return UnauthorizedProblem("Acesso restrito a serviços internos ou administradores.");
        }

        if (tenantId == Guid.Empty)
        {
            return BadRequestProblem("X-Tenant-ID header is required.");
        }

        try
        {
            var reservedCost = await _meteringService.ReserveCreditsForLlmAsync(tenantId, request);
            return Ok(new { reserved_cost = reservedCost });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Saldo insuficiente ou erro na reserva de créditos para tenant {TenantId}", tenantId);
            return BadRequestProblem(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro inesperado ao reservar créditos para tenant {TenantId}", tenantId);
            return ProblemResponse(StatusCodes.Status500InternalServerError, "Erro ao reservar créditos", ex.Message);
        }
    }

    [HttpPost("internal/refund")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> RefundCredits(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromBody] RefundCreditsRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!IsAuthorizedInternalService())
        {
            return UnauthorizedProblem("Acesso restrito a serviços internos ou administradores.");
        }

        if (tenantId == Guid.Empty)
        {
            return BadRequestProblem("X-Tenant-ID header is required.");
        }

        await _meteringService.RefundCreditsOnFailureAsync(tenantId, request.ReservedCost);
        return Ok();
    }

    [HttpPost("internal/record")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(LlmUsageLogResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> RecordUsage(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromBody] LlmUsageLogCreate request,
        CancellationToken cancellationToken = default)
    {
        if (!IsAuthorizedInternalService())
        {
            return UnauthorizedProblem("Acesso restrito a serviços internos ou administradores.");
        }

        if (tenantId == Guid.Empty)
        {
            return BadRequestProblem("X-Tenant-ID header is required.");
        }

        var result = await _meteringService.RecordUsageAndDeductAsync(tenantId, request);
        return Ok(result);
    }
}
