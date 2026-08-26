using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Checkout;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class CheckoutController : ControllerBase
    {
        private readonly ICheckoutService _checkoutService;

        public CheckoutController(ICheckoutService checkoutService)
        {
            _checkoutService = checkoutService;
        }

        private Guid GetTenantId()
        {
            if (HttpContext.Request.Headers.TryGetValue("X-Tenant-ID", out var tenantIdStr) && Guid.TryParse(tenantIdStr, out var tenantId))
            {
                return tenantId;
            }
            throw new UnauthorizedAccessException("X-Tenant-ID header is missing or invalid.");
        }

        [HttpPost("orders")]
        public async Task<IActionResult> CreateOrder([FromBody] CreateCheckoutRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var result = await _checkoutService.CreateOrderAsync(tenantId, request);
                return CreatedAtAction(nameof(GetOrder), new { id = result.Id }, result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { detail = ex.Message });
            }
        }

        [HttpGet("orders/{id}")]
        public async Task<IActionResult> GetOrder(Guid id)
        {
            var tenantId = GetTenantId();
            var result = await _checkoutService.GetOrderAsync(id, tenantId);
            if (result == null) return NotFound();
            return Ok(result);
        }
    }
}
