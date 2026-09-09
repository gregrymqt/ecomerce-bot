
using System;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.MercadoPago;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/[controller]")]
public class CheckoutController : BaseApiController
{
    private readonly ICheckoutService _checkoutService;
    private readonly ILogger<CheckoutController> _logger;

    public CheckoutController(ICheckoutService checkoutService, ILogger<CheckoutController> logger)
    {
        _checkoutService = checkoutService;
        _logger = logger;
    }

    [HttpGet("status/{paymentId}")]
    [ProducesResponseType(typeof(MercadoPagoOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPaymentStatus(string paymentId, CancellationToken cancellationToken = default)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty)
        {
            return BadRequestProblem("X-Tenant-ID header é obrigatório.");
        }

        var response = await _checkoutService.GetOrderStatusAsync(paymentId, tenantId, cancellationToken);
        if (response == null)
        {
            return NotFoundProblem($"Status do pagamento '{paymentId}' não encontrado.");
        }
        return Ok(response);
    }

    [HttpPost("orders")]
    [ProducesResponseType(typeof(MercadoPagoOrderResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateOrder([FromBody] MercadoPagoOrderRequest request, CancellationToken cancellationToken = default)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty)
        {
            return BadRequestProblem("X-Tenant-ID header is required.");
        }

        try
        {
            var result = await _checkoutService.CreateOrderAsync(tenantId, request, cancellationToken);
            if (Guid.TryParse(result.Id, out var orderGuid))
            {
                return CreatedAtAction(nameof(GetOrder), new { id = orderGuid }, result);
            }
            return StatusCode(StatusCodes.Status201Created, result);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Dados inválidos na criação do pedido para tenant {TenantId}", tenantId);
            return BadRequestProblem(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Operação inválida na criação do pedido para tenant {TenantId}", tenantId);
            return BadRequestProblem(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro inesperado ao criar pedido para tenant {TenantId}", tenantId);
            return ProblemResponse(StatusCodes.Status500InternalServerError, "Erro na criação de pedido", ex.Message);
        }
    }

    [HttpGet("orders/{id:guid}")]
    [ProducesResponseType(typeof(MercadoPagoOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetOrder(Guid id, CancellationToken cancellationToken = default)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty)
        {
            return BadRequestProblem("X-Tenant-ID header is required.");
        }

        var result = await _checkoutService.GetOrderAsync(id, tenantId, cancellationToken);
        if (result == null)
        {
            return NotFoundProblem($"Pedido '{id}' não encontrado.");
        }
        return Ok(result);
    }
}
