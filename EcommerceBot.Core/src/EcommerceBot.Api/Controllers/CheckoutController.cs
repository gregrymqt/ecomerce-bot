using System;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Checkout;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
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

    [HttpPost("pix")]
    [ProducesResponseType(typeof(PixPaymentResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreatePixPayment([FromBody] PixPaymentRequestDto request, CancellationToken cancellationToken = default)
    {
        var tenantId = CurrentTenantId != Guid.Empty ? CurrentTenantId : (Guid.TryParse(request.TenantId, out var g) ? g : Guid.Empty);
        if (tenantId == Guid.Empty)
        {
            return BadRequestProblem("X-Tenant-ID header ou tenant_id no corpo da requisição é obrigatório.");
        }

        try
        {
            var response = await _checkoutService.CreatePixOrderAsync(tenantId, request);
            return Ok(response);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Dados inválidos para geração de PIX no tenant {TenantId}", tenantId);
            return BadRequestProblem(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Operação inválida no checkout PIX para tenant {TenantId}", tenantId);
            return BadRequestProblem(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro inesperado ao gerar pagamento PIX para tenant {TenantId}", tenantId);
            return ProblemResponse(StatusCodes.Status500InternalServerError, "Erro no Checkout PIX", ex.Message);
        }
    }

    [HttpPost("card")]
    [ProducesResponseType(typeof(CreditCardPaymentResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ProcessCreditCardPayment([FromBody] CreditCardPaymentRequestDto request, CancellationToken cancellationToken = default)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty)
        {
            return BadRequestProblem("X-Tenant-ID header é obrigatório para pagamento via cartão.");
        }

        try
        {
            var response = await _checkoutService.ProcessCreditCardOrderAsync(tenantId, request);
            return Ok(response);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Dados inválidos para pagamento com cartão no tenant {TenantId}", tenantId);
            return BadRequestProblem(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Operação inválida no processamento de cartão para tenant {TenantId}", tenantId);
            return BadRequestProblem(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro inesperado ao processar pagamento com cartão no tenant {TenantId}", tenantId);
            return ProblemResponse(StatusCodes.Status500InternalServerError, "Erro no Checkout de Cartão", ex.Message);
        }
    }

    [HttpGet("status/{paymentId}")]
    [ProducesResponseType(typeof(OrderStatusSyncResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPaymentStatus(string paymentId, CancellationToken cancellationToken = default)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty)
        {
            return BadRequestProblem("X-Tenant-ID header é obrigatório.");
        }

        var response = await _checkoutService.GetOrderStatusAsync(paymentId, tenantId);
        if (response == null)
        {
            return NotFoundProblem($"Status do pagamento '{paymentId}' não encontrado.");
        }
        return Ok(response);
    }

    [HttpPost("orders")]
    [ProducesResponseType(typeof(CheckoutResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateOrder([FromBody] CreateCheckoutRequest request, CancellationToken cancellationToken = default)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty)
        {
            return BadRequestProblem("X-Tenant-ID header is required.");
        }

        try
        {
            var result = await _checkoutService.CreateOrderAsync(tenantId, request);
            return CreatedAtAction(nameof(GetOrder), new { id = result.Id }, result);
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
    [ProducesResponseType(typeof(CheckoutResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetOrder(Guid id, CancellationToken cancellationToken = default)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty)
        {
            return BadRequestProblem("X-Tenant-ID header is required.");
        }

        var result = await _checkoutService.GetOrderAsync(id, tenantId);
        if (result == null)
        {
            return NotFoundProblem($"Pedido '{id}' não encontrado.");
        }
        return Ok(result);
    }
}
