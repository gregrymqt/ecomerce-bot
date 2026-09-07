using System.Text.Json;
using System.Threading;
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
        [FromHeader(Name = "svix-signature")] string? svixSignature,
        CancellationToken cancellationToken = default)
    {
        var result = await _emailWebhookService.ProcessResendWebhookAsync(payload, svixId, svixTimestamp, svixSignature);

        return result.Status switch
        {
            WebhookResultStatus.InvalidSignature => UnauthorizedProblem(result.Message ?? "Assinatura do webhook Resend inválida."),
            WebhookResultStatus.Error => BadRequestProblem(result.Message ?? "Erro no processamento do webhook Resend."),
            _ => Ok(new { message = result.Message })
        };
    }
}
