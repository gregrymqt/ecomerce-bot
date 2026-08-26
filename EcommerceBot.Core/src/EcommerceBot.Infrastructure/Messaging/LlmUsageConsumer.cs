using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Messaging;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Messaging;

public class LlmUsageConsumer : IConsumer<LlmUsageEvent>
{
    private readonly IMeteringRepository _meteringRepository;
    private readonly ILogger<LlmUsageConsumer> _logger;

    public LlmUsageConsumer(
        IMeteringRepository meteringRepository,
        ILogger<LlmUsageConsumer> logger)
    {
        _meteringRepository = meteringRepository;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<LlmUsageEvent> context)
    {
        var msg = context.Message;
        _logger.LogInformation("Recebido LlmUsageEvent para Tenant {TenantId}, Model {Model}, TotalTokens {Tokens}",
            msg.TenantId, msg.ModelUsed, msg.TotalTokens);

        var log = new LlmUsageLog
        {
            TenantId = msg.TenantId,
            ProductId = msg.ProductId,
            Provider = msg.Provider,
            ModelUsed = msg.ModelUsed,
            PromptTokens = msg.PromptTokens,
            CompletionTokens = msg.CompletionTokens,
            TotalTokens = msg.TotalTokens > 0 ? msg.TotalTokens : (msg.PromptTokens + msg.CompletionTokens),
            EstimatedCostUsd = msg.EstimatedCostUsd,
            IsByok = msg.IsByok,
            ExecutionTimeMs = msg.ExecutionTimeMs
        };

        await _meteringRepository.CreateUsageLogAsync(log);

        if (!msg.IsByok && msg.EstimatedCostUsd > 0)
        {
            if (msg.ReservedCost.HasValue)
            {
                await _meteringRepository.AtomicSettleCreditsAsync(msg.TenantId, msg.ReservedCost.Value, msg.EstimatedCostUsd);
            }
            else
            {
                await _meteringRepository.AtomicReserveCreditsAsync(msg.TenantId, msg.EstimatedCostUsd);
            }
        }
    }
}
