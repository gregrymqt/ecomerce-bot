using System;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Enums;
using EcommerceBot.Domain.Interfaces;
using EcommerceBot.Infrastructure.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EcommerceBot.Infrastructure.Services;

public class EmailWebhookService : IEmailWebhookService
{
    private readonly IEmailRepository _emailRepository;
    private readonly ILogger<EmailWebhookService> _logger;
    private readonly string? _webhookSecret;

    public EmailWebhookService(
        IEmailRepository emailRepository,
        IOptions<ResendOptions> resendOptions,
        ILogger<EmailWebhookService> logger)
    {
        _emailRepository = emailRepository;
        _logger = logger;
        _webhookSecret = resendOptions.Value.WebhookSecret;
    }

    public async Task<WebhookProcessResult> ProcessResendWebhookAsync(
        JsonElement payload,
        string? svixId,
        string? svixTimestamp,
        string? svixSignature)
    {
        if (!string.IsNullOrEmpty(_webhookSecret))
        {
            var rawJson = payload.GetRawText();
            if (!VerifySvixSignature(rawJson, svixId, svixTimestamp, svixSignature, _webhookSecret))
            {
                _logger.LogWarning("Invalid or missing Resend Svix signature.");
                return new WebhookProcessResult
                {
                    Status = WebhookResultStatus.InvalidSignature,
                    Message = "Invalid webhook signature."
                };
            }
        }

        try
        {
            var type = payload.GetProperty("type").GetString();
            var data = payload.GetProperty("data");
            var resendId = data.GetProperty("email_id").GetString();

            if (string.IsNullOrEmpty(resendId))
            {
                return new WebhookProcessResult
                {
                    Status = WebhookResultStatus.Error,
                    Message = "Missing email_id in payload"
                };
            }

            EmailStatus status;
            string? error = null;

            switch (type)
            {
                case "email.delivered":
                    status = EmailStatus.DELIVERED;
                    break;
                case "email.bounced":
                    status = EmailStatus.BOUNCED;
                    error = data.TryGetProperty("reason", out var reasonProp) ? reasonProp.GetString() : "Bounced";
                    break;
                case "email.complained":
                    status = EmailStatus.COMPLAINED;
                    break;
                case "email.opened":
                    status = EmailStatus.OPENED;
                    break;
                case "email.clicked":
                    status = EmailStatus.CLICKED;
                    break;
                default:
                    _logger.LogInformation("Ignored Resend webhook type: {Type}", type);
                    return new WebhookProcessResult
                    {
                        Status = WebhookResultStatus.Success,
                        Message = $"Ignored type {type}"
                    };
            }

            await _emailRepository.UpdateEmailStatusByResendIdAsync(resendId, status, error);
            _logger.LogInformation("Updated email {ResendId} status to {Status}", resendId, status);

            return new WebhookProcessResult
            {
                Status = WebhookResultStatus.Success,
                Message = "Status updated successfully"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process Resend webhook payload");
            return new WebhookProcessResult
            {
                Status = WebhookResultStatus.Error,
                Message = "Invalid payload format"
            };
        }
    }

    private static bool VerifySvixSignature(string payload, string? svixId, string? svixTimestamp, string? svixSignature, string secret)
    {
        if (string.IsNullOrEmpty(secret) || string.IsNullOrEmpty(svixId) ||
            string.IsNullOrEmpty(svixTimestamp) || string.IsNullOrEmpty(svixSignature))
        {
            return false;
        }

        try
        {
            var cleanSecret = secret.StartsWith("whsec_") ? secret[6..] : secret;
            byte[] keyBytes;
            try { keyBytes = Convert.FromBase64String(cleanSecret); }
            catch { keyBytes = Encoding.UTF8.GetBytes(cleanSecret); }

            var toSign = $"{svixId}.{svixTimestamp}.{payload}";
            using var hmac = new HMACSHA256(keyBytes);
            var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(toSign));
            var expectedSig = "v1," + Convert.ToBase64String(hash);

            var sigParts = svixSignature.Split(' ');
            foreach (var sig in sigParts)
            {
                if (CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(sig),
                    Encoding.UTF8.GetBytes(expectedSig)))
                {
                    return true;
                }
            }
            return false;
        }
        catch
        {
            return false;
        }
    }
}
