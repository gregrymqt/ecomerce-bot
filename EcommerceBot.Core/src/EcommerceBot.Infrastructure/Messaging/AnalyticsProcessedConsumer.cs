using System;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Messaging;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Messaging;

public class AnalyticsProcessedConsumer : IConsumer<MlAnalysisResultMessage>
{
    private readonly IRedisService _redisService;
    private readonly IRobotActivityRepository _activityRepository;
    private readonly ILogger<AnalyticsProcessedConsumer> _logger;

    public AnalyticsProcessedConsumer(
        IRedisService redisService,
        IRobotActivityRepository activityRepository,
        ILogger<AnalyticsProcessedConsumer> logger)
    {
        _redisService = redisService;
        _activityRepository = activityRepository;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<MlAnalysisResultMessage> context)
    {
        var msg = context.Message;
        _logger.LogInformation("Recebido MlAnalysisResultMessage para Tenant {TenantId}. Status: {Status}",
            msg.TenantId, msg.Status);

        // 1. Registra a atividade em dbo.RobotActivities
        var detailsJson = JsonSerializer.Serialize(new
        {
            jobType = msg.JobType,
            status = msg.Status,
            rfm = msg.Rfm,
            churn = msg.Churn,
            ltv = msg.Ltv,
            error = msg.ErrorMessage
        });

        await _activityRepository.CreateAsync(new RobotActivity
        {
            TenantId = msg.TenantId,
            WorkerType = "ANALYTICS_ML",
            Status = msg.Status,
            DetailsJson = detailsJson,
            DurationMs = 1500
        });

        // 2. Dispara evento em tempo real no canal SSE do Tenant
        var channel = $"events:tenant:{msg.TenantId}";
        var ssePayload = JsonSerializer.Serialize(new
        {
            type = "analytics_ml_completed",
            tenantId = msg.TenantId,
            status = msg.Status,
            jobType = msg.JobType,
            data = new
            {
                rfm = msg.Rfm,
                churn = msg.Churn,
                ltv = msg.Ltv
            }
        });

        await _redisService.PublishAsync(channel, ssePayload);
    }
}
