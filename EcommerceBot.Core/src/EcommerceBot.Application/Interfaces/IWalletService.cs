using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Wallet;

namespace EcommerceBot.Application.Interfaces;

public interface IWalletService
{
    Task<WalletBalanceResponseDto> GetBalanceAsync(Guid tenantId);
    Task<WalletStatementResponseDto> GetStatementAsync(Guid tenantId, StatementFiltersDto filters);
    Task<RechargeResponseDto> CreateRechargeAsync(Guid tenantId, RechargeRequestDto request);
}
