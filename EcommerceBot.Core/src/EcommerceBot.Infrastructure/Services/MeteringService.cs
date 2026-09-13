using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Metering;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

public sealed class MeteringService : IMeteringService
{
    private readonly IMeteringRepository _repository;
    private readonly ILogger<MeteringService> _logger;

    private static readonly Dictionary<string, (decimal Prompt, decimal Completion)> PricingTable = new()
    {
        { "deepseek/deepseek-chat", (0.000140m, 0.000280m) },
        { "deepseek/deepseek-r1", (0.000550m, 0.002190m) },
        { "meta-llama/llama-3.3-70b-instruct", (0.000120m, 0.000300m) },
        { "google/gemini-flash-1.5", (0.000075m, 0.000300m) },
        { "google/gemini-2.0-flash-001", (0.000100m, 0.000400m) },
        { "default", (0.000200m, 0.000500m) }
    };

    public MeteringService(IMeteringRepository repository, ILogger<MeteringService> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public decimal CalculateTokenCost(string modelUsed, int promptTokens, int completionTokens)
    {
        var pricing = PricingTable.TryGetValue(modelUsed, out var prices) ? prices : PricingTable["default"];
        
        var promptCost = (promptTokens / 1000m) * pricing.Prompt;
        var completionCost = (completionTokens / 1000m) * pricing.Completion;
        
        return Math.Round(promptCost + completionCost, 6);
    }

    public async Task<TenantCreditBalanceResponse> GetTenantCreditBalanceAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            var balance = await _repository.GetManagedCreditBalanceAsync(tenantId, cancellationToken);
            var (monthlyTokens, monthlyCost) = await _repository.GetMonthlyTelemetryAsync(tenantId, cancellationToken);

            return new TenantCreditBalanceResponse
            {
                TenantId = tenantId.ToString(),
                ManagedCreditBalance = balance,
                MonthlyTotalTokens = monthlyTokens,
                MonthlyTotalCostUsd = monthlyCost,
                IsByokEnabled = false, // Em um cenário real, checaríamos as chaves configuradas
                ActiveMode = "managed"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao obter saldo de créditos gerenciados para o Tenant {TenantId}", tenantId);
            throw;
        }
    }

    public async Task<PaginatedLlmUsageLogResponse> GetTenantUsageLogsAsync(Guid tenantId, int page, int limit, DateTimeOffset? startDate, DateTimeOffset? endDate, CancellationToken cancellationToken = default)
    {
        try
        {
            var (items, totalCount) = await _repository.GetUsageLogsPaginatedAsync(tenantId, page, limit, startDate, endDate, cancellationToken);
            
            return new PaginatedLlmUsageLogResponse
            {
                Items = items.Select(x => new LlmUsageLogResponse
                {
                    Id = x.Id,
                    TenantId = x.TenantId.ToString(),
                    ProductId = x.ProductId,
                    Provider = x.Provider,
                    ModelUsed = x.ModelUsed,
                    PromptTokens = x.PromptTokens,
                    CompletionTokens = x.CompletionTokens,
                    TotalTokens = x.TotalTokens,
                    EstimatedCostUsd = x.EstimatedCostUsd,
                    IsByok = x.IsByok,
                    ExecutionTimeMs = x.ExecutionTimeMs,
                    CreatedAt = x.CreatedAt
                }),
                Total = totalCount,
                Page = page,
                Limit = limit,
                TotalPages = (int)Math.Ceiling(totalCount / (double)limit)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao consultar logs de uso de LLM para o Tenant {TenantId}", tenantId);
            throw;
        }
    }

    public async Task<decimal> ReserveCreditsForLlmAsync(Guid tenantId, ReserveCreditsRequest request, CancellationToken cancellationToken = default)
    {
        var estimatedCost = CalculateTokenCost(request.ModelUsed, request.EstimatedPromptTokens, request.EstimatedCompletionTokens);
        
        if (estimatedCost <= 0) return 0m;

        try
        {
            var success = await _repository.AtomicReserveCreditsAsync(tenantId, estimatedCost, cancellationToken);
            
            if (!success)
            {
                throw new InvalidOperationException("Insufficient credits to reserve for LLM operation.");
            }

            return estimatedCost;
        }
        catch (InvalidOperationException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao reservar créditos de LLM ({EstimatedCost} USD) para o Tenant {TenantId}", estimatedCost, tenantId);
            throw;
        }
    }

    public async Task RefundCreditsOnFailureAsync(Guid tenantId, decimal reservedCost, CancellationToken cancellationToken = default)
    {
        if (reservedCost > 0)
        {
            try
            {
                await _repository.AtomicRefundCreditsAsync(tenantId, reservedCost, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao reembolsar créditos reservados ({ReservedCost} USD) para o Tenant {TenantId}", reservedCost, tenantId);
                throw;
            }
        }
    }

    public async Task<LlmUsageLogResponse> RecordUsageAndDeductAsync(Guid tenantId, LlmUsageLogCreate request, CancellationToken cancellationToken = default)
    {
        var cost = request.EstimatedCostUsd;
        if (cost == 0 && (request.PromptTokens > 0 || request.CompletionTokens > 0))
        {
            cost = CalculateTokenCost(request.ModelUsed, request.PromptTokens, request.CompletionTokens);
        }

        var log = new LlmUsageLog
        {
            TenantId = tenantId,
            ProductId = request.ProductId,
            Provider = request.Provider,
            ModelUsed = request.ModelUsed,
            PromptTokens = request.PromptTokens,
            CompletionTokens = request.CompletionTokens,
            TotalTokens = request.TotalTokens > 0 ? request.TotalTokens : (request.PromptTokens + request.CompletionTokens),
            EstimatedCostUsd = cost,
            IsByok = request.IsByok,
            ExecutionTimeMs = request.ExecutionTimeMs
        };

        try
        {
            var savedLog = await _repository.CreateUsageLogAsync(log, cancellationToken);

            if (!request.IsByok && cost > 0)
            {
                if (request.ReservedCost.HasValue)
                {
                    await _repository.AtomicSettleCreditsAsync(tenantId, request.ReservedCost.Value, cost, cancellationToken);
                }
                else
                {
                    // Fallback se não houve reserva: deduz tudo de uma vez
                    await _repository.AtomicReserveCreditsAsync(tenantId, cost, cancellationToken);
                }
            }

            return new LlmUsageLogResponse
            {
                Id = savedLog.Id,
                TenantId = savedLog.TenantId.ToString(),
                ProductId = savedLog.ProductId,
                Provider = savedLog.Provider,
                ModelUsed = savedLog.ModelUsed,
                PromptTokens = savedLog.PromptTokens,
                CompletionTokens = savedLog.CompletionTokens,
                TotalTokens = savedLog.TotalTokens,
                EstimatedCostUsd = savedLog.EstimatedCostUsd,
                IsByok = savedLog.IsByok,
                ExecutionTimeMs = savedLog.ExecutionTimeMs,
                CreatedAt = savedLog.CreatedAt
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao registrar uso e deduzir créditos de LLM para o Tenant {TenantId}", tenantId);
            throw;
        }
    }
}
