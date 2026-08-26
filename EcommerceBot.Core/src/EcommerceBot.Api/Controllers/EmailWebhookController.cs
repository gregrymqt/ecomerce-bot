using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Domain.Enums;
using EcommerceBot.Domain.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Api.Controllers
{
    [ApiController]
    [Route("api/v1/emails/webhooks")]
    public class EmailWebhookController : ControllerBase
    {
        private readonly IEmailRepository _emailRepository;
        private readonly ILogger<EmailWebhookController> _logger;
        private readonly string? _webhookSecret;

        public EmailWebhookController(
            IEmailRepository emailRepository, 
            Microsoft.Extensions.Configuration.IConfiguration configuration,
            ILogger<EmailWebhookController> logger)
        {
            _emailRepository = emailRepository;
            _logger = logger;
            _webhookSecret = configuration["Resend:WebhookSecret"];
        }

        private bool VerifySvixSignature(string payload, string? svixId, string? svixTimestamp, string? svixSignature)
        {
            if (string.IsNullOrEmpty(_webhookSecret) || string.IsNullOrEmpty(svixId) || 
                string.IsNullOrEmpty(svixTimestamp) || string.IsNullOrEmpty(svixSignature))
            {
                return false;
            }

            try
            {
                var secret = _webhookSecret.StartsWith("whsec_") ? _webhookSecret.Substring(6) : _webhookSecret;
                byte[] keyBytes;
                try { keyBytes = Convert.FromBase64String(secret); }
                catch { keyBytes = System.Text.Encoding.UTF8.GetBytes(secret); }

                var toSign = $"{svixId}.{svixTimestamp}.{payload}";
                using var hmac = new System.Security.Cryptography.HMACSHA256(keyBytes);
                var hash = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(toSign));
                var expectedSig = "v1," + Convert.ToBase64String(hash);

                var sigParts = svixSignature.Split(' ');
                foreach (var sig in sigParts)
                {
                    if (System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
                        System.Text.Encoding.UTF8.GetBytes(sig),
                        System.Text.Encoding.UTF8.GetBytes(expectedSig)))
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

        [HttpPost("resend")]
        public async Task<IActionResult> ResendWebhook(
            [FromBody] JsonElement payload,
            [FromHeader(Name = "svix-id")] string? svixId,
            [FromHeader(Name = "svix-timestamp")] string? svixTimestamp,
            [FromHeader(Name = "svix-signature")] string? svixSignature)
        {
            if (!string.IsNullOrEmpty(_webhookSecret))
            {
                var rawJson = payload.GetRawText();
                if (!VerifySvixSignature(rawJson, svixId, svixTimestamp, svixSignature))
                {
                    _logger.LogWarning("Invalid or missing Resend Svix signature.");
                    return Unauthorized(new { detail = "Invalid webhook signature." });
                }
            }
            try
            {
                var type = payload.GetProperty("type").GetString();
                var data = payload.GetProperty("data");
                var resendId = data.GetProperty("email_id").GetString();

                if (string.IsNullOrEmpty(resendId))
                    return BadRequest("Missing email_id");

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
                        return Ok();
                }

                await _emailRepository.UpdateEmailStatusByResendIdAsync(resendId, status, error);
                _logger.LogInformation("Updated email {ResendId} status to {Status}", resendId, status);
                return Ok();
            }
            catch (System.Exception ex)
            {
                _logger.LogError(ex, "Failed to process Resend webhook");
                return BadRequest("Invalid payload format");
            }
        }
    }
}
