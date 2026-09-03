using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Analytics;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

public class AiCapacityService : IAiCapacityService
{
    private readonly IAiCapacityRepository _aiCapacityRepository;
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly ILogger<AiCapacityService> _logger;

    private static readonly string[] SupportedProviders = { "DEEPSEEK", "GEMINI", "OPENROUTER" };

    public AiCapacityService(
        IAiCapacityRepository aiCapacityRepository,
        IPublishEndpoint publishEndpoint,
        ILogger<AiCapacityService> logger)
    {
        _aiCapacityRepository = aiCapacityRepository;
        _publishEndpoint = publishEndpoint;
        _logger = logger;
    }

    public async Task<AiProviderCreditDto> RegisterTopupAsync(AiProviderCreditTopupRequest request)
    {
        var provider = request.Provider.ToUpperInvariant().Trim();
        if (!SupportedProviders.Contains(provider))
        {
            provider = "OPENROUTER"; // Fallback seguro para roteador multimodelo
        }
        request.Provider = provider;

        var balances = await _aiCapacityRepository.GetLatestBalancesAsync();
        var currentBalance = balances.GetValueOrDefault(provider, 0m);
        var newBalance = currentBalance + request.AmountPaid;

        var credit = new AiProviderCredit
        {
            Provider = provider,
            AmountPaid = request.AmountPaid,
            Currency = string.IsNullOrWhiteSpace(request.Currency) ? "USD" : request.Currency,
            TokensCredited = request.TokensCredited,
            BalanceRemaining = newBalance,
            TransactionReference = request.TransactionReference,
            Source = request.Source,
            Notes = request.Notes
        };

        var id = await _aiCapacityRepository.AddTopupAsync(credit);

        _logger.LogInformation(
            "Recarga de IA registrada com sucesso: {Provider} +${Amount} (Novo Saldo: ${NewBalance}) [Origem: {Source}]",
            provider, request.AmountPaid, newBalance, request.Source);

        return new AiProviderCreditDto
        {
            Id = id,
            Provider = provider,
            AmountPaid = request.AmountPaid,
            Currency = credit.Currency,
            TokensCredited = request.TokensCredited,
            BalanceRemaining = newBalance,
            TransactionReference = request.TransactionReference,
            Source = request.Source,
            Notes = request.Notes,
            CreatedAt = DateTimeOffset.UtcNow
        };
    }

    public async Task<AiCapacityOverviewResponse> GetCapacityOverviewAsync(int horizonDays = 30)
    {
        var balances = await _aiCapacityRepository.GetLatestBalancesAsync();
        var domainTopups = await _aiCapacityRepository.GetRecentTopupsAsync(20);
        var history = await _aiCapacityRepository.GetDailyUsageHistoryAsync(90);

        var topups = domainTopups.Select(t => new AiProviderCreditDto
        {
            Id = t.Id,
            Provider = t.Provider,
            AmountPaid = t.AmountPaid,
            Currency = t.Currency,
            TokensCredited = t.TokensCredited,
            BalanceRemaining = t.BalanceRemaining,
            TransactionReference = t.TransactionReference,
            Source = t.Source,
            Notes = t.Notes,
            CreatedAt = t.CreatedAt
        }).ToList();

        var providerDetails = new Dictionary<string, ProviderCapacityDetailDto>(StringComparer.OrdinalIgnoreCase);

        foreach (var provider in SupportedProviders)
        {
            var pHistory = history.Where(h => string.Equals(h.Provider, provider, StringComparison.OrdinalIgnoreCase)).ToList();
            var currentBalance = balances.GetValueOrDefault(provider, 0m);

            providerDetails[provider] = CalculateProviderMetrics(provider, pHistory, currentBalance, horizonDays);
        }

        var consolidated = CalculateConsolidatedMetrics(providerDetails, balances.Values.Sum(), horizonDays);

        return new AiCapacityOverviewResponse
        {
            ForecastHorizonDays = horizonDays,
            GeneratedAt = DateTimeOffset.UtcNow,
            Consolidated = consolidated,
            Providers = providerDetails,
            RecentTopups = topups
        };
    }

    public async Task<bool> TriggerForecastRecalculationAsync()
    {
        try
        {
            var balances = await _aiCapacityRepository.GetLatestBalancesAsync();
            var history = await _aiCapacityRepository.GetDailyUsageHistoryAsync(90);

            var message = new
            {
                tenantId = Guid.Empty,
                jobType = "TOKEN_CAPACITY_FORECAST",
                usageHistory = history.Select(h => new
                {
                    date = h.Date,
                    provider = h.Provider,
                    tokens = h.Tokens,
                    cost_usd = h.CostUsd
                }),
                currentBalances = balances,
                forecastDays = 30
            };

            await _publishEndpoint.Publish(message, ctx =>
            {
                ctx.SetRoutingKey("analytics_ml_queue");
            });

            _logger.LogInformation("Job de TOKEN_CAPACITY_FORECAST enfileirado no RabbitMQ.");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao disparar recálculo assíncrono de capacidade de IA.");
            return false;
        }
    }

    private ProviderCapacityDetailDto CalculateProviderMetrics(
        string provider,
        List<DailyTokenUsageSummary> pHistory,
        decimal currentBalance,
        int forecastDays)
    {
        long dailyTokens;
        decimal dailyCost;
        decimal sigmaTokens;
        decimal growthRate = 0.05m;
        long medianTokens;

        if (pHistory.Count < 2)
        {
            dailyTokens = provider == "DEEPSEEK" ? 60000 : provider == "GEMINI" ? 40000 : 25000;
            var defaultCostPerToken = provider == "DEEPSEEK" ? 0.000003m : provider == "GEMINI" ? 0.0000025m : 0.000005m;
            dailyCost = dailyTokens * defaultCostPerToken;
            sigmaTokens = dailyTokens * 0.30m;
            medianTokens = (long)(dailyTokens * 0.85m);
        }
        else
        {
            var n = pHistory.Count;
            decimal weightSum = 0;
            decimal weightedTokens = 0;
            decimal weightedCost = 0;

            for (int i = 0; i < n; i++)
            {
                decimal w = 0.6m + 0.8m * ((decimal)i / Math.Max(1, n - 1));
                weightSum += w;
                weightedTokens += w * pHistory[i].Tokens;
                weightedCost += w * pHistory[i].CostUsd;
            }

            dailyTokens = (long)(weightedTokens / Math.Max(1, weightSum));
            dailyCost = weightedCost / Math.Max(1, weightSum);

            var sortedTokens = pHistory.Select(h => h.Tokens).OrderBy(t => t).ToList();
            medianTokens = sortedTokens[n / 2];

            decimal variance = sortedTokens.Select(t => (decimal)Math.Pow((double)(t - dailyTokens), 2)).Sum() / Math.Max(1, n - 1);
            sigmaTokens = (decimal)Math.Sqrt((double)variance);

            var half = Math.Max(1, n / 2);
            var firstAvg = pHistory.Take(half).Select(h => h.Tokens).DefaultIfEmpty(1).Average();
            var secondAvg = pHistory.Skip(half).Select(h => h.Tokens).DefaultIfEmpty(1).Average();
            growthRate = (decimal)((secondAvg - firstAvg) / Math.Max(1.0, firstAvg));
            growthRate = Math.Clamp(growthRate, -0.20m, 0.60m);
        }

        var costPerToken = dailyTokens > 0 ? (dailyCost / dailyTokens) : 0.000003m;

        // 1. Baixa
        long lowTokens = Math.Max(1000, medianTokens * forecastDays);
        decimal lowCost = Math.Round(lowTokens * costPerToken, 2);

        // 2. Recomendada
        long recTokens = Math.Max(lowTokens, (long)(dailyTokens * (1.0m + growthRate) * forecastDays));
        decimal recCost = Math.Round(recTokens * costPerToken, 2);

        // 3. Segurança
        long safetyBuffer = (long)(2.0m * sigmaTokens * (decimal)Math.Sqrt(forecastDays));
        long safetyTokens = recTokens + Math.Max(5000, safetyBuffer);
        decimal safetyCost = Math.Round(safetyTokens * costPerToken, 2);

        decimal runwayDays = dailyCost > 0.0001m ? Math.Round(currentBalance / dailyCost, 1) : 999.0m;
        bool isCritical = runwayDays < 7.0m;
        decimal recommendedTopup = Math.Round(Math.Max(0m, recCost - currentBalance), 2);

        return new ProviderCapacityDetailDto
        {
            Provider = provider,
            CurrentBalanceUsd = currentBalance,
            DailyBurnRateTokens = dailyTokens,
            DailyBurnRateUsd = Math.Round(dailyCost, 4),
            GrowthRatePercent = Math.Round(growthRate * 100m, 1),
            RunwayDays = runwayDays,
            IsCritical = isCritical,
            RecommendedTopupUsd = recommendedTopup,
            Scenarios = new Dictionary<string, ScenarioDetailDto>
            {
                ["low"] = new()
                {
                    Label = "Baixa (Mínimo)",
                    Tokens = lowTokens,
                    EstimatedCostUsd = lowCost,
                    Description = "Consumo basal mínimo sem picos de demanda."
                },
                ["recommended"] = new()
                {
                    Label = "Recomendada (Ideal)",
                    Tokens = recTokens,
                    EstimatedCostUsd = recCost,
                    Description = "Previsão realista considerando crescimento e sazonalidade."
                },
                ["safety"] = new()
                {
                    Label = "Segurança (Buffer de Pico)",
                    Tokens = safetyTokens,
                    EstimatedCostUsd = safetyCost,
                    Description = "Margem de 95% para absorver surtos e scraping intensivo sem travar."
                }
            }
        };
    }

    private ConsolidatedCapacityDto CalculateConsolidatedMetrics(
        Dictionary<string, ProviderCapacityDetailDto> providerDetails,
        decimal totalBalance,
        int forecastDays)
    {
        long totBurnTokens = providerDetails.Values.Sum(p => p.DailyBurnRateTokens);
        decimal totBurnCost = providerDetails.Values.Sum(p => p.DailyBurnRateUsd);

        long totLowTokens = providerDetails.Values.Sum(p => p.Scenarios["low"].Tokens);
        decimal totLowCost = providerDetails.Values.Sum(p => p.Scenarios["low"].EstimatedCostUsd);

        long totRecTokens = providerDetails.Values.Sum(p => p.Scenarios["recommended"].Tokens);
        decimal totRecCost = providerDetails.Values.Sum(p => p.Scenarios["recommended"].EstimatedCostUsd);

        long totSafeTokens = providerDetails.Values.Sum(p => p.Scenarios["safety"].Tokens);
        decimal totSafeCost = providerDetails.Values.Sum(p => p.Scenarios["safety"].EstimatedCostUsd);

        decimal consolidatedRunway = totBurnCost > 0.0001m ? Math.Round(totalBalance / totBurnCost, 1) : 999.0m;
        bool isCritical = consolidatedRunway < 7.0m || providerDetails.Values.Any(p => p.IsCritical);
        decimal recommendedTopup = Math.Round(Math.Max(0m, totRecCost - totalBalance), 2);

        return new ConsolidatedCapacityDto
        {
            CurrentTotalBalanceUsd = totalBalance,
            DailyBurnRateTokensTotal = totBurnTokens,
            DailyBurnRateUsdTotal = Math.Round(totBurnCost, 4),
            ConsolidatedRunwayDays = consolidatedRunway,
            IsCritical = isCritical,
            RecommendedTopupUsd = recommendedTopup,
            Scenarios = new Dictionary<string, ScenarioDetailDto>
            {
                ["low"] = new()
                {
                    Label = "Baixa (Mínimo)",
                    Tokens = totLowTokens,
                    EstimatedCostUsd = totLowCost,
                    Description = "Demanda mínima esperada para o próximo mês."
                },
                ["recommended"] = new()
                {
                    Label = "Recomendada (Ideal)",
                    Tokens = totRecTokens,
                    EstimatedCostUsd = totRecCost,
                    Description = "Valor ideal de compra para manter a operação saudável."
                },
                ["safety"] = new()
                {
                    Label = "Segurança (Buffer de Pico)",
                    Tokens = totSafeTokens,
                    EstimatedCostUsd = totSafeCost,
                    Description = "Reserva contra picos para que o sistema nunca pare."
                }
            }
        };
    }
}
