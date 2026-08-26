using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Api.Filters;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/emails/webhooks")]
[AllowAnonymous]
[RateLimit(MaxRequests = 120, WindowSeconds = 60, BlockDurationSeconds = 300)]
public class EmailWebhookController : BaseApiController
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
