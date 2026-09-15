using EcommerceBot.Application.DTOs.Wallet;

public interface IWalletService
{
    Task<WalletBalanceResponseDto> GetBalanceAsync(Guid tenantId, CancellationToken ct = default);
    Task<WalletStatementResponseDto> GetStatementAsync(Guid tenantId, StatementFiltersDto filters, CancellationToken ct = default);
    Task<RechargeResponseDto> CreateRechargeAsync(Guid tenantId, CreateRechargeRequestDto request, CancellationToken ct = default);
    Task<RechargeResponseDto?> GetRechargeByIdAsync(Guid orderId, Guid tenantId, CancellationToken ct = default);
}