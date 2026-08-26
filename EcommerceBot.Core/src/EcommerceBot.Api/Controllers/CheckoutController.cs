using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Checkout;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/[controller]")]
public class CheckoutController : BaseApiController
{
    private readonly ICheckoutService _checkoutService;

    public CheckoutController(ICheckoutService checkoutService)
    {
        _checkoutService = checkoutService;
    }

    [HttpPost("orders")]
    public async Task<IActionResult> CreateOrder([FromBody] CreateCheckoutRequest request)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty)
            return BadRequest(new { detail = "X-Tenant-ID header is required." });

        try
        {
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
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty)
            return BadRequest(new { detail = "X-Tenant-ID header is required." });

        var result = await _checkoutService.GetOrderAsync(id, tenantId);
        if (result == null) return NotFound();
        return Ok(result);
    }
}
