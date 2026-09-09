using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

public interface IAiCapacityRepository
{
    Task<Guid> AddTopupAsync(AiProviderCredit credit, CancellationToken cancellationToken = default);
    Task<List<AiProviderCredit>> GetRecentTopupsAsync(int limit = 20, CancellationToken cancellationToken = default);
    Task<Dictionary<string, decimal>> GetLatestBalancesAsync(CancellationToken cancellationToken = default);
    Task<List<DailyTokenUsageSummary>> GetDailyUsageHistoryAsync(int days = 90, CancellationToken cancellationToken = default);
}
