using System;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Wallet;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/[controller]")]
public class WalletController : BaseApiController
{
    private readonly IWalletService _walletService;
    private readonly ILogger<WalletController> _logger;

    public WalletController(IWalletService walletService, ILogger<WalletController> logger)
    {
        _walletService = walletService;
        _logger = logger;
    }

    [HttpGet("credit-packages")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCreditPackages([FromServices] IPlanService planService, CancellationToken cancellationToken = default)
    {
        var packages = await planService.GetAllPlansAsync(onlyActive: true, cancellationToken: cancellationToken);
        return Ok(packages);
    }

    [HttpGet("balance")]
    [ProducesResponseType(typeof(WalletBalanceResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetBalance(CancellationToken cancellationToken = default)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty)
        {
            return BadRequestProblem("X-Tenant-ID header é obrigatório.");
        }

        try
        {
            var result = await _walletService.GetBalanceAsync(tenantId, cancellationToken);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Erro ao obter saldo da carteira do tenant {TenantId}", tenantId);
            return BadRequestProblem(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro inesperado ao consultar saldo do tenant {TenantId}", tenantId);
            return ProblemResponse(StatusCodes.Status500InternalServerError, "Erro ao consultar saldo", ex.Message);
        }
    }

    [HttpGet("statement")]
    [ProducesResponseType(typeof(WalletStatementResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetStatement(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        [FromQuery] string? type = "ALL",
        CancellationToken cancellationToken = default)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty)
        {
            return BadRequestProblem("X-Tenant-ID header é obrigatório.");
        }

        var filters = new StatementFiltersDto
        {
            Page = page > 0 ? page : 1,
            Limit = limit > 0 ? limit : 20,
            Type = type
        };

        var result = await _walletService.GetStatementAsync(tenantId, filters, cancellationToken);
        return Ok(result);
    }

    [HttpPost("recharge")]
    [ProducesResponseType(typeof(RechargeResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateRecharge([FromBody] RechargeRequestDto request, CancellationToken cancellationToken = default)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty)
        {
            return BadRequestProblem("X-Tenant-ID header é obrigatório.");
        }

        try
        {
            var result = await _walletService.CreateRechargeAsync(tenantId, request, cancellationToken);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Dados inválidos para recarga no tenant {TenantId}", tenantId);
            return BadRequestProblem(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Operação inválida na recarga para tenant {TenantId}", tenantId);
            return BadRequestProblem(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro inesperado ao criar recarga para tenant {TenantId}", tenantId);
            return ProblemResponse(StatusCodes.Status500InternalServerError, "Erro na recarga de créditos", ex.Message);
        }
    }
}
