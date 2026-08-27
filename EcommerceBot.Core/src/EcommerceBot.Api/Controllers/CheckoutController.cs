using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Checkout;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
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

    [HttpPost("pix")]
    public async Task<IActionResult> CreatePixPayment([FromBody] PixPaymentRequestDto request)
    {
        var tenantId = CurrentTenantId != Guid.Empty ? CurrentTenantId : (Guid.TryParse(request.TenantId, out var g) ? g : Guid.Empty);
        if (tenantId == Guid.Empty)
        {
            return BadRequest(new { detail = "X-Tenant-ID header ou tenant_id no corpo da requisição é obrigatório." });
        }

        try
        {
            var response = await _checkoutService.CreatePixOrderAsync(tenantId, request);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(new { detail = ex.Message });
        }
    }

    [HttpPost("card")]
    public async Task<IActionResult> ProcessCreditCardPayment([FromBody] CreditCardPaymentRequestDto request)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty)
        {
            return BadRequest(new { detail = "X-Tenant-ID header é obrigatório para pagamento via cartão." });
        }

        try
        {
            var response = await _checkoutService.ProcessCreditCardOrderAsync(tenantId, request);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(new { detail = ex.Message });
        }
    }

    [HttpGet("status/{paymentId}")]
    public async Task<IActionResult> GetPaymentStatus(string paymentId)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty)
        {
            return BadRequest(new { detail = "X-Tenant-ID header é obrigatório." });
        }

        var response = await _checkoutService.GetOrderStatusAsync(paymentId, tenantId);
        return Ok(response);
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
