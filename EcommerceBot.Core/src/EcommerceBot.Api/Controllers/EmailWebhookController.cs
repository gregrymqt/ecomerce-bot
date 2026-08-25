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

        public EmailWebhookController(IEmailRepository emailRepository, ILogger<EmailWebhookController> logger)
        {
            _emailRepository = emailRepository;
            _logger = logger;
        }

        [HttpPost("resend")]
        public async Task<IActionResult> ResendWebhook([FromBody] JsonElement payload)
        {
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
