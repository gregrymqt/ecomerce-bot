using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

public interface IAiCapacityRepository
{
    Task<Guid> AddTopupAsync(AiProviderCredit credit);
    Task<List<AiProviderCredit>> GetRecentTopupsAsync(int limit = 20);
    Task<Dictionary<string, decimal>> GetLatestBalancesAsync();
    Task<List<DailyTokenUsageSummary>> GetDailyUsageHistoryAsync(int days = 90);
}
