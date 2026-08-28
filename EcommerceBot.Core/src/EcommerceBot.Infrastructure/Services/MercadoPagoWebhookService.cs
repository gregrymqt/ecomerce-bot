using System;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Messaging;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Infrastructure.Options;
using MassTransit;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EcommerceBot.Infrastructure.Services;

public class MercadoPagoWebhookService : IMercadoPagoWebhookService
{
    private readonly IRedisService _redisService;
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly ILogger<MercadoPagoWebhookService> _logger;
    private readonly string? _webhookSecret;

    private static readonly Regex TsV1Regex = new(@"(?:ts=(?<ts>\d+))|(?:v1=(?<v1>[a-fA-F0-9]+))", RegexOptions.Compiled);

    public MercadoPagoWebhookService(
        IRedisService redisService,
        IPublishEndpoint publishEndpoint,
        IOptions<MercadoPagoOptions> mercadoPagoOptions,
        ILogger<MercadoPagoWebhookService> logger)
    {
        _redisService = redisService;
        _publishEndpoint = publishEndpoint;
        _logger = logger;
        _webhookSecret = mercadoPagoOptions.Value.WebhookSecret;
    }

    public async Task<WebhookProcessResult> ProcessWebhookAsync(
        string rawBody,
        string? dataId,
        string? idParam,
        string? xSignature,
        string? xRequestId)
    {
        try
        {
            var resourceId = dataId ?? idParam ?? string.Empty;

            if (string.IsNullOrEmpty(_webhookSecret))
            {
                _logger.LogWarning("MercadoPago:WebhookSecret is not configured. Rejecting request for security.");
                return new WebhookProcessResult
                {
                    Status = WebhookResultStatus.MissingSecret,
                    Message = "Webhook secret not configured on server."
                };
            }

            if (string.IsNullOrEmpty(xSignature) || !VerifySignature(xSignature, xRequestId, resourceId, _webhookSecret))
            {
                _logger.LogWarning("Invalid or missing Mercado Pago webhook signature.");
                return new WebhookProcessResult
                {
                    Status = WebhookResultStatus.InvalidSignature,
                    Message = "Invalid webhook signature."
                };
            }

            JsonDocument payload;
            try
            {
                payload = JsonDocument.Parse(rawBody);
            }
            catch
            {
                payload = JsonDocument.Parse("{}");
            }

            var root = payload.RootElement;
            var action = string.Empty;
            var topic = string.Empty;

            if (root.TryGetProperty("action", out var actionElement))
            {
                action = actionElement.GetString() ?? string.Empty;
            }
            else if (root.TryGetProperty("type", out var typeElement))
            {
                action = typeElement.GetString() ?? string.Empty;
            }

            if (root.TryGetProperty("topic", out var topicElement))
            {
                topic = topicElement.GetString() ?? string.Empty;
            }

            if (string.IsNullOrEmpty(resourceId))
            {
                if (root.TryGetProperty("data", out var dataObj) && dataObj.TryGetProperty("id", out var idInBody))
                {
                    resourceId = idInBody.GetString() ?? idInBody.GetInt64().ToString();
                }
                else if (root.TryGetProperty("id", out var directId))
                {
                    resourceId = directId.GetString() ?? directId.GetInt64().ToString();
                }
            }

            _logger.LogInformation("Processing Mercado Pago webhook action: {Action}, topic: {Topic}, resource_id: {ResourceId}", action, topic, resourceId);

            if (!string.IsNullOrEmpty(resourceId))
            {
                var idempotencyKey = $"webhook:idempotency:mp:{resourceId}:{action}";
                var isNew = await _redisService.SetIfNotExistsAsync(idempotencyKey, "processed", TimeSpan.FromHours(24));
                if (!isNew)
                {
                    _logger.LogInformation("Mercado Pago webhook already processed for resource {ResourceId} and action {Action}", resourceId, action);
                    return new WebhookProcessResult
                    {
                        Status = WebhookResultStatus.AlreadyProcessed,
                        Message = "Already processed"
                    };
                }
            }

            // Publica o evento assíncrono para processamento desacoplado em payments_process_queue
            await _publishEndpoint.Publish(new PaymentReceivedEvent
            {
                ResourceId = resourceId,
                Action = action,
                RawPayload = rawBody,
                ReceivedAt = DateTimeOffset.UtcNow
            }, ctx =>
            {
                ctx.SetRoutingKey("payments_process_queue");
            });

            _logger.LogInformation("Published PaymentReceivedEvent to RabbitMQ queue 'payments_process_queue' for {ResourceId}", resourceId);

            return new WebhookProcessResult
            {
                Status = WebhookResultStatus.Success,
                Message = "Received"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process Mercado Pago webhook");
            return new WebhookProcessResult
            {
                Status = WebhookResultStatus.Error,
                Message = "Processed defensively"
            };
        }
    }

    private static bool VerifySignature(string xSignature, string? xRequestId, string dataId, string secret)
    {
        var matches = TsV1Regex.Matches(xSignature);
        string? ts = null;
        string? v1 = null;

        foreach (Match match in matches)
        {
            if (match.Groups["ts"].Success)
                ts = match.Groups["ts"].Value;
            else if (match.Groups["v1"].Success)
                v1 = match.Groups["v1"].Value;
        }

        if (string.IsNullOrEmpty(ts) || string.IsNullOrEmpty(v1))
            return false;

        var manifestBuilder = new StringBuilder();
        if (!string.IsNullOrEmpty(dataId))
            manifestBuilder.Append($"id:{dataId.ToLower()};");

        if (!string.IsNullOrEmpty(xRequestId))
            manifestBuilder.Append($"request-id:{xRequestId};");

        manifestBuilder.Append($"ts:{ts};");

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hashBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(manifestBuilder.ToString()));
        var computedHash = BitConverter.ToString(hashBytes).Replace("-", "").ToLower();

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(computedHash),
            Encoding.UTF8.GetBytes(v1.ToLower()));
    }
}
