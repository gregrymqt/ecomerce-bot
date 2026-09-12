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

public sealed class PaymentProcessingConsumer : IConsumer<PaymentReceivedEvent>
{
    private readonly IOrderRepository _orderRepository;
    private readonly ITenantRepository _tenantRepository;
    private readonly IPlanRepository _planRepository;
    private readonly IMercadoPagoGateway _mercadoPagoGateway;
    private readonly IRedisService _redisService;
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly IRobotActivityRepository _activityRepository;
    private readonly ILogger<PaymentProcessingConsumer> _logger;

    public PaymentProcessingConsumer(
        IOrderRepository orderRepository,
        ITenantRepository tenantRepository,
        IPlanRepository planRepository,
        IMercadoPagoGateway mercadoPagoGateway,
        IRedisService redisService,
        IPublishEndpoint publishEndpoint,
        IRobotActivityRepository activityRepository,
        ILogger<PaymentProcessingConsumer> logger)
    {
        _orderRepository = orderRepository;
        _tenantRepository = tenantRepository;
        _planRepository = planRepository;
        _mercadoPagoGateway = mercadoPagoGateway;
        _redisService = redisService;
        _publishEndpoint = publishEndpoint;
        _activityRepository = activityRepository;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<PaymentReceivedEvent> context)
    {
        var ct = context.CancellationToken;
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

            var mpOrder = await _mercadoPagoGateway.GetOrderByIdAsync(resourceId, ct);
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
                var mpPayment = await _mercadoPagoGateway.GetPaymentByIdAsync(resourceId, ct);
                if (mpPayment != null)
                {
                    externalRef = mpPayment.ExternalReference;
                    status = mpPayment.Status;
                    statusDetail = mpPayment.StatusDetail;
                    paidAmount = mpPayment.TransactionAmount ?? 0m;
                    payerEmail = mpPayment.Payer?.Email;
                }
            }

            // Fallback resiliente: extrai dados do RawPayload do webhook se a consulta à API externa retornar nulo
            // (ex: simulações no painel do Mercado Pago com IDs fictícios como "123456" ou falhas transitórias de rede)
            if (string.IsNullOrEmpty(externalRef) && !string.IsNullOrWhiteSpace(msg.RawPayload))
            {
                try
                {
                    using var doc = System.Text.Json.JsonDocument.Parse(msg.RawPayload);
                    var root = doc.RootElement;
                    var dataEl = root.TryGetProperty("data", out var d) ? d : root;

                    if (dataEl.TryGetProperty("external_reference", out var extRefEl))
                    {
                        externalRef = extRefEl.GetString();
                    }

                    if (dataEl.TryGetProperty("status", out var stEl))
                    {
                        status = stEl.GetString();
                    }

                    if (dataEl.TryGetProperty("status_detail", out var stDetEl))
                    {
                        statusDetail = stDetEl.GetString();
                    }

                    if (dataEl.TryGetProperty("total_paid_amount", out var paidEl))
                    {
                        if (paidEl.ValueKind == System.Text.Json.JsonValueKind.Number && paidEl.TryGetDecimal(out var dVal))
                        {
                            paidAmount = dVal;
                        }
                        else if (decimal.TryParse(paidEl.GetString(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var parsedVal))
                        {
                            paidAmount = parsedVal;
                        }
                    }

                    _logger.LogInformation(
                        "Mercado Pago Webhook Fallback do RawPayload aplicado para ResourceId: {ResourceId}. Ref: {Ref}, Status: {Status}, Detail: {Detail}",
                        resourceId, externalRef, status, statusDetail);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Falha ao extrair dados de fallback do RawPayload para {ResourceId}", resourceId);
                }
            }

            _logger.LogInformation("Mercado Pago Reconciliation - Ref: {Ref}, Status: {Status}, Detail: {Detail}, Amount: {Amount}",
                externalRef, status, statusDetail, paidAmount);

            // 2. Localiza o pedido correspondente no banco
            Order? order = null;
            if (!string.IsNullOrEmpty(externalRef))
            {
                order = await _orderRepository.GetOrderByExternalReferenceGlobalAsync(externalRef, ct);
            }

            if (order == null)
            {
                order = await _orderRepository.GetOrderByMpPaymentIdAsync(resourceId, ct);
            }

            var tenantId = order?.TenantId ?? Guid.Empty;

            // 3. Processa aprovação de pagamento
            var isApproved = (status == "processed" && statusDetail == "accredited") || 
                             (status == "approved");

            if (isApproved)
            {
                int creditsToAdd = 0;
                string packageName = "Recarga de Créditos";
                int newBalance = 0;

                if (order != null)
                {
                    order.Status = "approved";
                    order.PaidAt = DateTimeOffset.UtcNow;
                    order.TotalPaidAmount = paidAmount > 0 ? paidAmount : order.TotalAmount;
                    order.MpPaymentId = resourceId;
                    await _orderRepository.UpdateOrderAsync(order, ct);

                    // Concessão de créditos de IA desvinculada de assinaturas
                    if (order.PlanId.HasValue)
                    {
                        var plan = await _planRepository.GetByIdAsync(order.PlanId.Value, ct);
                        if (plan != null)
                        {
                            creditsToAdd = plan.CreditsIncluded;
                            packageName = plan.Name;
                        }
                    }

                    if (creditsToAdd <= 0)
                    {
                        creditsToAdd = (int)Math.Ceiling(order.TotalAmount * 10);
                    }

                    _logger.LogInformation("Concedendo {Credits} créditos (Pacote: {Package}) para Tenant {TenantId}",
                        creditsToAdd, packageName, order.TenantId);

                    newBalance = await _tenantRepository.AddCreditsAsync(
                        tenantId: order.TenantId,
                        amount: creditsToAdd,
                        type: "RECHARGE",
                        description: $"Recarga de IA aprovada: {packageName} (+{creditsToAdd} créditos)",
                        referenceId: order.ExternalReference ?? resourceId,
                        orderId: order.Id,
                        cancellationToken: ct
                    );

                    tenantId = order.TenantId;
                    payerEmail = !string.IsNullOrEmpty(order.PayerEmail) ? order.PayerEmail : payerEmail;

                    // 4. Notifica o Frontend via Server-Sent Events (SSE) através do canal Redis
                    var ssePayload = JsonSerializer.Serialize(new
                    {
                        type = "payment_approved",
                        order_id = order.Id.ToString(),
                        status = "approved",
                        amount = paidAmount,
                        credits_added = creditsToAdd,
                        balance_credits = newBalance
                    });
                    await _redisService.PublishAsync($"events:tenant:{tenantId}", ssePayload);

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
                            { "orderId", order.Id.ToString() },
                            { "amount", paidAmount },
                            { "status", "approved" },
                            { "packageName", packageName },
                            { "creditsAdded", creditsToAdd },
                            { "balanceCredits", newBalance },
                            { "paymentMethod", order.PaymentMethod?.ToUpper() ?? "PIX" }
                        }
                    }, ctx =>
                    {
                        ctx.SetRoutingKey("email_notifications");
                    }, ct);

                    _logger.LogInformation("Payment {ResourceId} approved and credited successfully for tenant {TenantId}", resourceId, tenantId);
                }
                else
                {
                    _logger.LogWarning(
                        "Webhook conciliado como aprovado ({Status}/{Detail}), porém nenhum pedido correspondente foi localizado no banco de dados para ExternalReference: '{Ref}' ou ResourceId: '{ResourceId}'.",
                        status, statusDetail, externalRef, resourceId);
                }
            }
            else if (status == "failed" || status == "rejected" || status == "canceled")
            {
                if (order != null)
                {
                    order.Status = "rejected";
                    await _orderRepository.UpdateOrderAsync(order, ct);
                }
                _logger.LogWarning("Payment {ResourceId} rejected or failed with detail {Detail}", resourceId, statusDetail);
            }
            else if (status == "refunded" || status == "charged_back" || status == "cancelled")
            {
                if (order != null)
                {
                    bool wasPaid = order.PaidAt != null || order.Status == "approved";
                    bool alreadyReverted = order.Status == "refunded" || order.Status == "charged_back";

                    order.Status = status == "charged_back" ? "charged_back" : "refunded";
                    await _orderRepository.UpdateOrderAsync(order, ct);

                    if (wasPaid && !alreadyReverted)
                    {
                        int creditsToRevert = 0;
                        if (order.PlanId.HasValue)
                        {
                            var plan = await _planRepository.GetByIdAsync(order.PlanId.Value, ct);
                            if (plan != null)
                            {
                                creditsToRevert = plan.CreditsIncluded;
                            }
                        }

                        if (creditsToRevert <= 0)
                        {
                            creditsToRevert = (int)Math.Ceiling(order.TotalAmount * 10);
                        }

                        _logger.LogWarning("Revertendo {Credits} créditos por {Status} do pedido {OrderId} do Tenant {TenantId}",
                            creditsToRevert, status, order.Id, order.TenantId);

                        var newBalance = await _tenantRepository.ReverseCreditsAsync(
                            tenantId: order.TenantId,
                            amount: creditsToRevert,
                            type: "CHARGEBACK_REVERSAL",
                            description: $"Estorno / Chargeback Mercado Pago ({status}): -{creditsToRevert} créditos",
                            referenceId: order.ExternalReference ?? resourceId,
                            orderId: order.Id,
                            cancellationToken: ct
                        );

                        if (newBalance < 0)
                        {
                            _logger.LogCritical("INCIDENTE DE SEGURANÇA / INADIMPLÊNCIA: Tenant {TenantId} teve estorno/chargeback de {Credits} créditos e saldo ficou negativo ({NewBalance}). Conta suspensa preventivamente.",
                                order.TenantId, creditsToRevert, newBalance);
                        }

                        // Notifica Frontend via SSE através do canal Redis
                        var ssePayload = JsonSerializer.Serialize(new
                        {
                            type = "payment_refunded",
                            order_id = order.Id.ToString(),
                            status = order.Status,
                            amount = paidAmount > 0 ? paidAmount : order.TotalAmount,
                            credits_reverted = creditsToRevert,
                            balance_credits = newBalance
                        });
                        await _redisService.PublishAsync($"events:tenant:{order.TenantId}", ssePayload);
                    }
                }
                _logger.LogWarning("Payment {ResourceId} refunded, charged back or cancelled.", resourceId);
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
