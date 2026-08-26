using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Emails;
using EcommerceBot.Application.DTOs.Messaging;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Messaging;

public class PaymentProcessingConsumer : IConsumer<PaymentReceivedEvent>
{
    private readonly IOrderRepository _orderRepository;
    private readonly ITenantRepository _tenantRepository;
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly IRobotActivityRepository _activityRepository;
    private readonly ILogger<PaymentProcessingConsumer> _logger;

    public PaymentProcessingConsumer(
        IOrderRepository orderRepository,
        ITenantRepository tenantRepository,
        IPublishEndpoint publishEndpoint,
        IRobotActivityRepository activityRepository,
        ILogger<PaymentProcessingConsumer> logger)
    {
        _orderRepository = orderRepository;
        _tenantRepository = tenantRepository;
        _publishEndpoint = publishEndpoint;
        _activityRepository = activityRepository;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<PaymentReceivedEvent> context)
    {
        var msg = context.Message;
        _logger.LogInformation("Processing asynchronous PaymentReceivedEvent for ResourceId {ResourceId}, Action {Action}",
            msg.ResourceId, msg.Action);

        // Registra atividade em dbo.RobotActivities
        await _activityRepository.CreateAsync(new RobotActivity
        {
            TenantId = Guid.Empty, // Se desconhecido no webhook raw
            WorkerType = "PAYMENT_PROCESSOR",
            Status = "PROCESSED",
            DetailsJson = msg.RawPayload,
            DurationMs = 200
        });

        // Se a ação for de aprovação de pagamento, enfileira notificação de email
        if (msg.Action.Contains("approved") || msg.Action.Contains("payment.created"))
        {
            await _publishEndpoint.Publish(new EmailEventPayload
            {
                TenantId = Guid.Empty,
                Event = "payment.approved",
                RecipientEmail = "financeiro@ecommercebot.local",
                RecipientName = "Cliente",
                IdempotencyKey = $"email:payment:{msg.ResourceId}",
                Data = new Dictionary<string, object>
                {
                    { "resourceId", msg.ResourceId },
                    { "action", msg.Action }
                }
            }, ctx =>
            {
                ctx.SetRoutingKey("email_notifications");
            });

            _logger.LogInformation("Dispatched confirmation email notification for ResourceId {ResourceId}", msg.ResourceId);
        }
    }
}
