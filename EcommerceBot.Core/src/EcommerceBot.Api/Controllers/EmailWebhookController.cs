using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Api.Controllers;

[ApiController]
[Route("api/v1/emails/webhooks")]
public class EmailWebhookController : ControllerBase
{
    private readonly IEmailWebhookService _emailWebhookService;
    private readonly ILogger<EmailWebhookController> _logger;

    public EmailWebhookController(
        IEmailWebhookService emailWebhookService,
        ILogger<EmailWebhookController> logger)
    {
        _emailWebhookService = emailWebhookService;
        _logger = logger;
    }

    [HttpPost("resend")]
    public async Task<IActionResult> ResendWebhook(
        [FromBody] JsonElement payload,
        [FromHeader(Name = "svix-id")] string? svixId,
        [FromHeader(Name = "svix-timestamp")] string? svixTimestamp,
        [FromHeader(Name = "svix-signature")] string? svixSignature)
    {
        var result = await _emailWebhookService.ProcessResendWebhookAsync(payload, svixId, svixTimestamp, svixSignature);

        return result.Status switch
        {
            WebhookResultStatus.InvalidSignature => Unauthorized(new { detail = result.Message }),
            WebhookResultStatus.Error => BadRequest(new { detail = result.Message }),
            _ => Ok(new { message = result.Message })
        };
    }
}
