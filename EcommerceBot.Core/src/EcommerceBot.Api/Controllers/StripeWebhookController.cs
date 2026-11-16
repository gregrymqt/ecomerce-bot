using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Api.Filters;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/webhooks/stripe")]
[AllowAnonymous]
[RateLimit(MaxRequests = 120, WindowSeconds = 60, BlockDurationSeconds = 300)]
public class StripeWebhookController : BaseApiController
{
    private readonly IStripeWebhookService _webhookService;
    private readonly ILogger<StripeWebhookController> _logger;

    public StripeWebhookController(
        IStripeWebhookService webhookService,
        ILogger<StripeWebhookController> logger)
    {
        _webhookService = webhookService;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> ReceiveWebhook(
        [FromHeader(Name = "Stripe-Signature")] string? stripeSignature,
        CancellationToken cancellationToken = default)
    {
        using var reader = new StreamReader(Request.Body, Encoding.UTF8);
        var rawBody = await reader.ReadToEndAsync(cancellationToken);

        var result = await _webhookService.ProcessWebhookAsync(rawBody, stripeSignature, cancellationToken);

        return result.Status switch
        {
            StripeWebhookResultStatus.MissingSecret => UnauthorizedProblem(result.Message ?? "Stripe webhook secret not configured."),
            StripeWebhookResultStatus.InvalidSignature => UnauthorizedProblem(result.Message ?? "Invalid Stripe signature."),
            StripeWebhookResultStatus.AlreadyProcessed => Ok(new { status = "already_processed", event_id = result.EventId }),
            StripeWebhookResultStatus.Error => Ok(new { status = "error", message = result.Message }),
            _ => Ok(new { status = "received", event_id = result.EventId })
        };
    }
}
