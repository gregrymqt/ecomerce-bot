using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Metering;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class MeteringController : ControllerBase
    {
        private readonly IMeteringService _meteringService;
        private readonly Microsoft.Extensions.Configuration.IConfiguration _configuration;

        public MeteringController(IMeteringService meteringService, Microsoft.Extensions.Configuration.IConfiguration configuration)
        {
            _meteringService = meteringService;
            _configuration = configuration;
        }

        private bool IsAuthorizedInternalService()
        {
            var internalKey = _configuration["Security:InternalServiceKey"];
            if (!string.IsNullOrEmpty(internalKey))
            {
                if (Request.Headers.TryGetValue("X-Internal-Secret", out var providedKey) &&
                    System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
                        System.Text.Encoding.UTF8.GetBytes(providedKey.ToString()),
                        System.Text.Encoding.UTF8.GetBytes(internalKey)))
                {
                    return true;
                }
            }

            if (User.Identity?.IsAuthenticated == true && (User.IsInRole("ADMIN") || User.IsInRole("SYSTEM")))
            {
                return true;
            }

            return false;
        }

        private Guid GetTenantId()
        {
            if (HttpContext.Request.Headers.TryGetValue("X-Tenant-ID", out var tenantIdStr) && Guid.TryParse(tenantIdStr, out var tenantId))
            {
                return tenantId;
            }
            throw new UnauthorizedAccessException("X-Tenant-ID header is missing or invalid.");
        }

        [HttpGet("balance")]
        [Authorize]
        public async Task<IActionResult> GetBalance()
        {
            var tenantId = GetTenantId();
            var result = await _meteringService.GetTenantCreditBalanceAsync(tenantId);
            return Ok(result);
        }

        [HttpGet("usage")]
        [Authorize]
        public async Task<IActionResult> GetUsageLogs([FromQuery] int page = 1, [FromQuery] int limit = 20, [FromQuery] DateTimeOffset? startDate = null, [FromQuery] DateTimeOffset? endDate = null)
        {
            var tenantId = GetTenantId();
            var result = await _meteringService.GetTenantUsageLogsAsync(tenantId, page, limit, startDate, endDate);
            return Ok(result);
        }

        [HttpPost("internal/reserve")]
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
        public async Task<IActionResult> RefundCredits([FromHeader(Name = "X-Tenant-ID")] Guid tenantId, [FromBody] RefundCreditsRequest request)
        {
            if (!IsAuthorizedInternalService())
                return Unauthorized(new { detail = "Acesso restrito a serviços internos ou administradores." });

            await _meteringService.RefundCreditsOnFailureAsync(tenantId, request.ReservedCost);
            return Ok();
        }

        [HttpPost("internal/record")]
        public async Task<IActionResult> RecordUsage([FromHeader(Name = "X-Tenant-ID")] Guid tenantId, [FromBody] LlmUsageLogCreate request)
        {
            if (!IsAuthorizedInternalService())
                return Unauthorized(new { detail = "Acesso restrito a serviços internos ou administradores." });

            var result = await _meteringService.RecordUsageAndDeductAsync(tenantId, request);
            return Ok(result);
        }
    }
}
