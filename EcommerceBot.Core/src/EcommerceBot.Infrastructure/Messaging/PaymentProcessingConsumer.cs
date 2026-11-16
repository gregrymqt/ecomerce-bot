using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Emails;
using EcommerceBot.Application.DTOs.Messaging;
using EcommerceBot.Application.DTOs.Stripe;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Application.Security;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Messaging;

public sealed class PaymentProcessingConsumer : IConsumer<PaymentReceivedEvent>
{
    private readonly IOrderRepository _orderRepository;
    private readonly ITenantRepository _tenantRepository;
    private readonly IPlanRepository _planRepository;
    private readonly IStripeGateway _stripeGateway;
    private readonly IRedisService _redisService;
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly IRobotActivityRepository _activityRepository;
    private readonly ILogger<PaymentProcessingConsumer> _logger;
    private readonly IUserRepository _userRepository;

    public PaymentProcessingConsumer(
        IOrderRepository orderRepository,
        ITenantRepository tenantRepository,
        IPlanRepository planRepository,
        IStripeGateway stripeGateway,
        IRedisService redisService,
        IPublishEndpoint publishEndpoint,
        IRobotActivityRepository activityRepository,
        ILogger<PaymentProcessingConsumer> logger,
        IUserRepository userRepository)
    {
        _orderRepository = orderRepository;
        _tenantRepository = tenantRepository;
        _planRepository = planRepository;
        _stripeGateway = stripeGateway;
        _redisService = redisService;
        _publishEndpoint = publishEndpoint;
        _activityRepository = activityRepository;
        _logger = logger;
        _userRepository = userRepository;
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
            // 1. Consulta no Stripe Gateway (PaymentIntents ou Invoices)
            string? externalRef = null;
            string? status = null;
            string? statusDetail = null;
            decimal paidAmount = 0m;
            string? payerEmail = null;

            var stripeIntent = await _stripeGateway.GetPaymentIntentByIdAsync(resourceId, ct);
            if (stripeIntent != null)
            {
                if (stripeIntent.Metadata.TryGetValue("external_reference", out var ext))
                {
                    externalRef = ext;
                }
                else
                {
                    externalRef = stripeIntent.Id;
                }

                status = string.Equals(stripeIntent.Status, "succeeded", StringComparison.OrdinalIgnoreCase)
                    ? "approved"
                    : stripeIntent.Status;
                statusDetail = stripeIntent.Status;
                paidAmount = stripeIntent.Amount;
            }
            else
            {
                var stripeInvoice = await _stripeGateway.GetInvoiceByIdAsync(resourceId, ct);
                if (stripeInvoice != null)
                {
                    externalRef = stripeInvoice.Id;
                    status = string.Equals(stripeInvoice.Status, "paid", StringComparison.OrdinalIgnoreCase)
                        ? "approved"
                        : stripeInvoice.Status;
                    statusDetail = stripeInvoice.Status;
                    paidAmount = stripeInvoice.AmountPaid;
                }
            }

            // Fallback resiliente: extrai dados do RawPayload do webhook se a consulta à API externa retornar nulo
            if (string.IsNullOrEmpty(externalRef) && !string.IsNullOrWhiteSpace(msg.RawPayload))
            {
                try
                {
                    using var doc = JsonDocument.Parse(msg.RawPayload);
                    var root = doc.RootElement;
                    var dataEl = root.TryGetProperty("data", out var d) && d.TryGetProperty("object", out var o) ? o : root;

                    if (dataEl.TryGetProperty("metadata", out var metaEl) && metaEl.TryGetProperty("external_reference", out var extRefEl))
                    {
                        externalRef = extRefEl.GetString();
                    }
                    else if (dataEl.TryGetProperty("id", out var idEl))
                    {
                        externalRef = idEl.GetString();
                    }

                    if (dataEl.TryGetProperty("status", out var stEl))
                    {
                        var rawSt = stEl.GetString();
                        status = string.Equals(rawSt, "succeeded", StringComparison.OrdinalIgnoreCase) || string.Equals(rawSt, "paid", StringComparison.OrdinalIgnoreCase)
                            ? "approved"
                            : rawSt;
                        statusDetail = rawSt;
                    }

                    if (dataEl.TryGetProperty("amount", out var amtEl) && amtEl.TryGetInt64(out var cents))
                    {
                        paidAmount = cents / 100m;
                    }
                    else if (dataEl.TryGetProperty("amount_paid", out var paidAmtEl) && paidAmtEl.TryGetInt64(out var paidCents))
                    {
                        paidAmount = paidCents / 100m;
                    }

                    _logger.LogInformation(
                        "Stripe Webhook Fallback do RawPayload aplicado para ResourceId: {ResourceId}. Ref: {Ref}, Status: {Status}, Detail: {Detail}",
                        resourceId, externalRef, status, statusDetail);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Falha ao extrair dados de fallback do RawPayload para {ResourceId}", resourceId);
                }
            }

            _logger.LogInformation("Stripe Reconciliation - Ref: {Ref}, Status: {Status}, Detail: {Detail}, Amount: {Amount}",
                externalRef, status, statusDetail, paidAmount);

            // 2. Localiza o pedido correspondente no banco
            Order? order = null;
            if (!string.IsNullOrEmpty(externalRef))
            {
                order = await _orderRepository.GetOrderByExternalReferenceGlobalAsync(externalRef, ct);
            }

            order ??= await _orderRepository.GetOrderByMpPaymentIdAsync(resourceId, ct);

            var tenantId = order?.TenantId ?? Guid.Empty;
            using var tenantScope = tenantId != Guid.Empty ? TenantSessionScope.BeginScope(tenantId) : null;

            // 3. Processa aprovação de pagamento
            var isApproved = string.Equals(status, "approved", StringComparison.OrdinalIgnoreCase) ||
                             string.Equals(status, "succeeded", StringComparison.OrdinalIgnoreCase) ||
                             string.Equals(status, "paid", StringComparison.OrdinalIgnoreCase) ||
                             (status == "processed" && statusDetail == "accredited");

            if (isApproved)
            {
                int creditsToAdd = 0;
                string packageName = "Recarga de Créditos";
                int newBalance = 0;

                if (order != null)
                {
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

                    var (applied, updatedBalance) = await _tenantRepository.TryCreditOrderOnceAsync(
                        tenantId: order.TenantId,
                        orderId: order.Id,
                        amount: creditsToAdd,
                        type: "RECHARGE",
                        description: $"Recarga de IA aprovada: {packageName} (+{creditsToAdd} créditos)",
                        referenceId: order.ExternalReference ?? resourceId,
                        mpPaymentId: resourceId,
                        paidAmount: paidAmount > 0 ? paidAmount : order.TotalAmount,
                        cancellationToken: ct
                    );
                    newBalance = updatedBalance;
                    tenantId = order.TenantId;

                    if (!applied)
                    {
                        _logger.LogInformation(
                            "Concessão idempotente ignorada para pedido {OrderId} (ResourceId {ResourceId}): pedido já liquidado ou em estado terminal ({Status}).",
                            order.Id, resourceId, order.Status);
                    }
                    else
                    {
                        _logger.LogInformation("Concedendo {Credits} créditos (Pacote: {Package}) para Tenant {TenantId}",
                            creditsToAdd, packageName, order.TenantId);

                        payerEmail = !string.IsNullOrEmpty(order.PayerEmail) ? order.PayerEmail : payerEmail;

                        if (!string.IsNullOrWhiteSpace(payerEmail))
                        {
                            var user = await _userRepository.GetByEmailAndTenantAsync(payerEmail, order.TenantId, ct);
                            if (user != null && user.Role == "MEMBER")
                            {
                                user.Role = "TENANT_ADMIN";
                                await _userRepository.UpdateAsync(user, ct);

                                _logger.LogInformation("Usuário {UserId} promovido com sucesso para TENANT_ADMIN após confirmação do pedido {OrderId}",
                                    user.Id, order.Id);
                            }
                        }

                        // 4. Notifica o Frontend via Server-Sent Events (SSE) através do canal Redis
                        var ssePayload = JsonSerializer.Serialize(new
                        {
                            type = "payment_approved",
                            order_id = order.Id.ToString(),
                            status = "approved",
                            amount = paidAmount > 0 ? paidAmount : order.TotalAmount,
                            credits_added = creditsToAdd,
                            balance_credits = newBalance,
                            refresh_required = true,
                            new_role = "TENANT_ADMIN"
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
                                { "amount", paidAmount > 0 ? paidAmount : order.TotalAmount },
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

                    // Notifica Frontend via SSE através do canal Redis
                    var ssePayload = JsonSerializer.Serialize(new
                    {
                        type = "payment_rejected",
                        order_id = order.Id.ToString(),
                        status = "rejected",
                        reason = statusDetail ?? "Pagamento não autorizado pela instituição bancária ou operadora."
                    });
                    await _redisService.PublishAsync($"events:tenant:{order.TenantId}", ssePayload);
                }
                _logger.LogWarning("Payment {ResourceId} rejected or failed with detail {Detail}", resourceId, statusDetail);
            }
            else if (status == "refunded" || status == "charged_back" || status == "cancelled")
            {
                if (order != null)
                {
                    var newOrderStatus = status == "charged_back" ? "charged_back" : "refunded";
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

                    var (reverted, newBalance) = await _tenantRepository.TryReverseOrderCreditsOnceAsync(
                        tenantId: order.TenantId,
                        orderId: order.Id,
                        amount: creditsToRevert,
                        type: "CHARGEBACK_REVERSAL",
                        description: $"Estorno / Chargeback Mercado Pago ({status}): -{creditsToRevert} créditos",
                        referenceId: order.ExternalReference ?? resourceId,
                        newOrderStatus: newOrderStatus,
                        cancellationToken: ct
                    );

                    if (reverted)
                    {
                        _logger.LogWarning("Revertendo {Credits} créditos por {Status} do pedido {OrderId} do Tenant {TenantId}",
                            creditsToRevert, status, order.Id, order.TenantId);

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
                            status = newOrderStatus,
                            amount = paidAmount > 0 ? paidAmount : order.TotalAmount,
                            credits_reverted = creditsToRevert,
                            balance_credits = newBalance
                        });
                        await _redisService.PublishAsync($"events:tenant:{order.TenantId}", ssePayload);
                    }
                }
                _logger.LogWarning("Payment {ResourceId} refunded, charged back or cancelled.", resourceId);
            }

            // Registra atividade em dbo.RobotActivities somente quando o TenantId foi resolvido (evita violar RLS/FK com Guid.Empty)
            if (tenantId != Guid.Empty)
            {
                await _activityRepository.CreateAsync(new RobotActivity
                {
                    TenantId = tenantId,
                    WorkerType = "PAYMENT_PROCESSOR",
                    Status = isApproved ? "PROCESSED" : (status ?? "RECEIVED"),
                    DetailsJson = msg.RawPayload,
                    DurationMs = 150
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process payment event for resource {ResourceId}", resourceId);
            throw;
        }
    }
}
