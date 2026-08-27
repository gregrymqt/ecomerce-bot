using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Wallet;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/[controller]")]
public class WalletController : BaseApiController
{
    private readonly IWalletService _walletService;

    public WalletController(IWalletService walletService)
    {
        _walletService = walletService;
    }

    [HttpGet("balance")]
    public async Task<IActionResult> GetBalance()
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty)
            return BadRequest(new { detail = "X-Tenant-ID header é obrigatório." });

        try
        {
            var result = await _walletService.GetBalanceAsync(tenantId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { detail = ex.Message });
        }
    }

    [HttpGet("statement")]
    public async Task<IActionResult> GetStatement([FromQuery] int page = 1, [FromQuery] int limit = 20, [FromQuery] string? type = "ALL")
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty)
            return BadRequest(new { detail = "X-Tenant-ID header é obrigatório." });

        var filters = new StatementFiltersDto
        {
            Page = page > 0 ? page : 1,
            Limit = limit > 0 ? limit : 20,
            Type = type
        };

        var result = await _walletService.GetStatementAsync(tenantId, filters);
        return Ok(result);
    }

    [HttpPost("recharge")]
    public async Task<IActionResult> CreateRecharge([FromBody] RechargeRequestDto request)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty)
            return BadRequest(new { detail = "X-Tenant-ID header é obrigatório." });

        try
        {
            var result = await _walletService.CreateRechargeAsync(tenantId, request);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { detail = ex.Message });
        }
    }
}
