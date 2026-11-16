using System;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Messaging;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Infrastructure.Options;
using EcommerceBot.Infrastructure.Messaging;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Stripe;

namespace EcommerceBot.Infrastructure.Services;

/// <summary>
/// Serviço de processamento defensivo de webhooks Stripe com validação HMAC e idempotência de 72 horas.
/// </summary>
public sealed class StripeWebhookService : IStripeWebhookService
{
    private readonly IRedisService _redisService;
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly ILogger<StripeWebhookService> _logger;
    private readonly string? _webhookSecret;

    public StripeWebhookService(
        IRedisService redisService,
        IPublishEndpoint publishEndpoint,
        IOptions<StripeOptions> stripeOptions,
        ILogger<StripeWebhookService> logger)
    {
        _redisService = redisService;
        _publishEndpoint = publishEndpoint;
        _logger = logger;
        _webhookSecret = stripeOptions.Value.WebhookSecret;
    }

    public async Task<StripeWebhookProcessResult> ProcessWebhookAsync(
        string rawPayload,
        string? stripeSignatureHeader,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(_webhookSecret))
            {
                _logger.LogWarning("Stripe:WebhookSecret is not configured. Rejecting webhook request.");
                return new StripeWebhookProcessResult
                {
                    Status = StripeWebhookResultStatus.MissingSecret,
                    Message = "Webhook secret not configured on server."
                };
            }

            if (string.IsNullOrWhiteSpace(stripeSignatureHeader))
            {
                _logger.LogWarning("Stripe-Signature header missing from request.");
                return new StripeWebhookProcessResult
                {
                    Status = StripeWebhookResultStatus.InvalidSignature,
                    Message = "Missing Stripe-Signature header."
                };
            }

            Event stripeEvent;
            try
            {
                stripeEvent = EventUtility.ConstructEvent(
                    rawPayload,
                    stripeSignatureHeader,
                    _webhookSecret,
                    throwOnApiVersionMismatch: false);
            }
            catch (StripeException ex)
            {
                _logger.LogWarning(ex, "Failed to validate Stripe webhook signature.");
                return new StripeWebhookProcessResult
                {
                    Status = StripeWebhookResultStatus.InvalidSignature,
                    Message = $"Invalid Stripe signature: {ex.Message}"
                };
            }

            var eventId = stripeEvent.Id;
            var eventType = stripeEvent.Type;
            var resourceId = ExtractResourceId(stripeEvent);

            _logger.LogInformation("Processing Stripe webhook: EventId={EventId}, Type={EventType}, ResourceId={ResourceId}",
                eventId, eventType, resourceId);

            // Verificação de idempotência (72h) no Redis
            var idempotencyKey = $"webhook:idempotency:stripe:{eventId}";
            var idempotencyAcquired = await _redisService.SetIfNotExistsAsync(
                idempotencyKey,
                "processed",
                TimeSpan.FromHours(72),
                cancellationToken);

            if (!idempotencyAcquired)
            {
                _logger.LogInformation("Stripe webhook {EventId} was already processed. Skipping.", eventId);
                return new StripeWebhookProcessResult
                {
                    Status = StripeWebhookResultStatus.AlreadyProcessed,
                    Message = "Already processed",
                    EventId = eventId,
                    EventType = eventType,
                    ResourceId = resourceId
                };
            }

            // Publica evento para fila/stream assíncrona
            try
            {
                await _publishEndpoint.Publish(new PaymentReceivedEvent
                {
                    ResourceId = resourceId,
                    Action = eventType,
                    RawPayload = rawPayload,
                    ReceivedAt = DateTimeOffset.UtcNow
                }, ctx =>
                {
                    ctx.SetRoutingKey("payments_process_queue");
                }, cancellationToken);
            }
            catch
            {
                // Em caso de falha de publicação no stream/broker, desfaz o lock de idempotência
                await _redisService.RemoveAsync(idempotencyKey, CancellationToken.None);
                throw;
            }

            _logger.LogInformation("Published PaymentReceivedEvent to 'payments_process_queue' for Stripe resource {ResourceId}", resourceId);

            return new StripeWebhookProcessResult
            {
                Status = StripeWebhookResultStatus.Success,
                Message = "Webhook accepted and published",
                EventId = eventId,
                EventType = eventType,
                ResourceId = resourceId
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Defensive failure during Stripe webhook processing.");
            return new StripeWebhookProcessResult
            {
                Status = StripeWebhookResultStatus.Error,
                Message = "Internal error during webhook processing"
            };
        }
    }

    private static string ExtractResourceId(Event stripeEvent)
    {
        if (stripeEvent.Data.Object is IHasId hasId && !string.IsNullOrWhiteSpace(hasId.Id))
        {
            return hasId.Id;
        }

        return stripeEvent.Id ?? string.Empty;
    }
}
