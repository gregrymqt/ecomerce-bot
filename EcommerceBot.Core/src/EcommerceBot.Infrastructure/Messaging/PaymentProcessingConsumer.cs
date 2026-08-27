using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Emails;
using EcommerceBot.Application.DTOs.Messaging;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Messaging;

public class PaymentProcessingConsumer : IConsumer<PaymentReceivedEvent>
{
    private readonly IOrderRepository _orderRepository;
    private readonly ITenantRepository _tenantRepository;
    private readonly ISubscriptionService _subscriptionService;
    private readonly IMercadoPagoGateway _mercadoPagoGateway;
    private readonly IRedisService _redisService;
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly IRobotActivityRepository _activityRepository;
    private readonly ILogger<PaymentProcessingConsumer> _logger;

    public PaymentProcessingConsumer(
        IOrderRepository orderRepository,
        ITenantRepository tenantRepository,
        ISubscriptionService subscriptionService,
        IMercadoPagoGateway mercadoPagoGateway,
        IRedisService redisService,
        IPublishEndpoint publishEndpoint,
        IRobotActivityRepository activityRepository,
        ILogger<PaymentProcessingConsumer> logger)
    {
        _orderRepository = orderRepository;
        _tenantRepository = tenantRepository;
        _subscriptionService = subscriptionService;
        _mercadoPagoGateway = mercadoPagoGateway;
        _redisService = redisService;
        _publishEndpoint = publishEndpoint;
        _activityRepository = activityRepository;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<PaymentReceivedEvent> context)
    {
        var msg = context.Message;
        var resourceId = msg.ResourceId;

        _logger.LogInformation("Processing asynchronous PaymentReceivedEvent for ResourceId: {ResourceId}, Action: {Action}",
            resourceId, msg.Action);

        if (string.IsNullOrWhiteSpace(resourceId))
        {
            _logger.LogWarning("Received empty ResourceId in PaymentReceivedEvent. Ignoring.");
            return;
        }

        try
        {
            // 1. Consulta no Mercado Pago (Orders API primeiro, depois Payments API)
            string? externalRef = null;
            string? status = null;
            string? statusDetail = null;
            decimal paidAmount = 0m;
            string? payerEmail = null;

            var mpOrder = await _mercadoPagoGateway.GetOrderByIdAsync(resourceId);
            if (mpOrder != null)
            {
                externalRef = mpOrder.ExternalReference;
                status = mpOrder.Status;
                statusDetail = mpOrder.StatusDetail;
                
                if (decimal.TryParse(mpOrder.TotalPaidAmount?.ToString(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var parsedPaid))
                {
                    paidAmount = parsedPaid;
                }
                else if (decimal.TryParse(mpOrder.TotalAmount?.ToString(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var parsedTotal))
                {
                    paidAmount = parsedTotal;
                }
            }
            else
            {
                var mpPayment = await _mercadoPagoGateway.GetPaymentByIdAsync(resourceId);
                if (mpPayment != null)
                {
                    externalRef = mpPayment.ExternalReference;
                    status = mpPayment.Status;
                    statusDetail = mpPayment.StatusDetail;
                    paidAmount = mpPayment.TransactionAmount ?? 0m;
                    payerEmail = mpPayment.Payer?.Email;
                }
            }

            _logger.LogInformation("Mercado Pago Reconciliation - Ref: {Ref}, Status: {Status}, Detail: {Detail}, Amount: {Amount}",
                externalRef, status, statusDetail, paidAmount);

            // 2. Localiza o pedido correspondente no banco
            Order? order = null;
            if (!string.IsNullOrEmpty(externalRef))
            {
                order = await _orderRepository.GetOrderByExternalReferenceGlobalAsync(externalRef);
            }

            if (order == null)
            {
                order = await _orderRepository.GetOrderByMpPaymentIdAsync(resourceId);
            }

            var tenantId = order?.TenantId ?? Guid.Empty;

            // 3. Processa aprovação de pagamento
            var isApproved = (status == "processed" && statusDetail == "accredited") || 
                             (status == "approved");

            if (isApproved)
            {
                if (order != null)
                {
                    order.Status = "approved";
                    order.PaidAt = DateTimeOffset.UtcNow;
                    order.TotalPaidAmount = paidAmount > 0 ? paidAmount : order.TotalAmount;
                    order.MpPaymentId = resourceId;
                    await _orderRepository.UpdateOrderAsync(order);

                    // Concessão de benefícios
                    if (order.PlanId.HasValue)
                    {
                        _logger.LogInformation("Activating/Renewing SaaS plan {PlanId} for tenant {TenantId}", order.PlanId.Value, order.TenantId);
                        await _subscriptionService.ActivateOrRenewSubscriptionAsync(order.TenantId, order.PlanId.Value, mpPreapprovalId: resourceId, mpPayerId: order.PayerEmail);
                    }
                    else
                    {
                        // Recarga de Carteira / Saldo IA
                        _logger.LogInformation("Adding {Amount} to ManagedCreditBalance for tenant {TenantId}", order.TotalAmount, order.TenantId);
                        await _tenantRepository.AddManagedBalanceAsync(order.TenantId, order.TotalAmount);
                    }

                    tenantId = order.TenantId;
                    payerEmail = !string.IsNullOrEmpty(order.PayerEmail) ? order.PayerEmail : payerEmail;
                }

                // 4. Notifica o Frontend via Server-Sent Events (SSE) através do canal Redis
                if (tenantId != Guid.Empty)
                {
                    var ssePayload = JsonSerializer.Serialize(new
                    {
                        type = "payment_approved",
                        order_id = order?.Id.ToString() ?? resourceId,
                        status = "approved",
                        amount = paidAmount
                    });
                    await _redisService.PublishAsync($"events:tenant:{tenantId}", ssePayload);
                }

                // 5. Envia email transacional de confirmação para o pagador real
                var targetEmail = !string.IsNullOrEmpty(payerEmail) ? payerEmail : "financeiro@ecommercebot.local";
                await _publishEndpoint.Publish(new EmailEventPayload
                {
                    TenantId = tenantId,
                    Event = "payment.approved",
                    RecipientEmail = targetEmail,
                    RecipientName = "Cliente",
                    IdempotencyKey = $"email:payment:{resourceId}",
                    Data = new Dictionary<string, object>
                    {
                        { "resourceId", resourceId },
                        { "orderId", order?.Id.ToString() ?? string.Empty },
                        { "amount", paidAmount },
                        { "status", "approved" }
                    }
                }, ctx =>
                {
                    ctx.SetRoutingKey("email_notifications");
                });

                _logger.LogInformation("Payment {ResourceId} approved and credited successfully for tenant {TenantId}", resourceId, tenantId);
            }
            else if (status == "failed" || status == "rejected" || status == "canceled")
            {
                if (order != null)
                {
                    order.Status = "rejected";
                    await _orderRepository.UpdateOrderAsync(order);
                }
                _logger.LogWarning("Payment {ResourceId} rejected or failed with detail {Detail}", resourceId, statusDetail);
            }
            else if (status == "refunded" || status == "charged_back")
            {
                if (order != null)
                {
                    order.Status = "refunded";
                    await _orderRepository.UpdateOrderAsync(order);
                    if (order.PlanId.HasValue)
                    {
                        await _subscriptionService.CancelSubscriptionAsync(order.TenantId);
                    }
                }
                _logger.LogWarning("Payment {ResourceId} refunded or charged back. Subscription paused.", resourceId);
            }

            // Registra atividade em dbo.RobotActivities
            await _activityRepository.CreateAsync(new RobotActivity
            {
                TenantId = tenantId,
                WorkerType = "PAYMENT_PROCESSOR",
                Status = isApproved ? "PROCESSED" : (status ?? "RECEIVED"),
                DetailsJson = msg.RawPayload,
                DurationMs = 150
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process payment event for resource {ResourceId}", resourceId);
            throw;
        }
    }
}
