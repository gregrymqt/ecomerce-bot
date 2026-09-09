using System;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Wallet;

namespace EcommerceBot.Application.Interfaces;

public interface IWalletService
{
    Task<WalletBalanceResponseDto> GetBalanceAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<WalletStatementResponseDto> GetStatementAsync(Guid tenantId, StatementFiltersDto filters, CancellationToken cancellationToken = default);
    Task<RechargeResponseDto> CreateRechargeAsync(Guid tenantId, RechargeRequestDto request, CancellationToken cancellationToken = default);
}
