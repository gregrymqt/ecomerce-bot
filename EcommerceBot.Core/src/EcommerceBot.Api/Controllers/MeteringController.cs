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

        public MeteringController(IMeteringService meteringService)
        {
            _meteringService = meteringService;
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
        // In a real app this would be protected by an internal API key or network policy
        public async Task<IActionResult> ReserveCredits([FromHeader(Name = "X-Tenant-ID")] Guid tenantId, [FromBody] ReserveCreditsRequest request)
        {
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
            await _meteringService.RefundCreditsOnFailureAsync(tenantId, request.ReservedCost);
            return Ok();
        }

        [HttpPost("internal/record")]
        public async Task<IActionResult> RecordUsage([FromHeader(Name = "X-Tenant-ID")] Guid tenantId, [FromBody] LlmUsageLogCreate request)
        {
            var result = await _meteringService.RecordUsageAndDeductAsync(tenantId, request);
            return Ok(result);
        }
    }
}
