using System.IO;
using System.Text;
using System.Threading.Tasks;
using EcommerceBot.Api.Filters;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/webhooks/mercadopago")]
[AllowAnonymous]
[RateLimit(MaxRequests = 120, WindowSeconds = 60, BlockDurationSeconds = 300)]
public class MercadoPagoWebhookController : BaseApiController
{
    private readonly IMercadoPagoWebhookService _webhookService;
    private readonly ILogger<MercadoPagoWebhookController> _logger;

    public MercadoPagoWebhookController(
        IMercadoPagoWebhookService webhookService,
        ILogger<MercadoPagoWebhookController> logger)
    {
        _webhookService = webhookService;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> ReceiveWebhook(
        [FromQuery(Name = "data.id")] string? dataId,
        [FromQuery(Name = "id")] string? idParam,
        [FromHeader(Name = "x-signature")] string? xSignature,
        [FromHeader(Name = "x-request-id")] string? xRequestId)
    {
        using var reader = new StreamReader(Request.Body, Encoding.UTF8);
        var rawBody = await reader.ReadToEndAsync();

        var result = await _webhookService.ProcessWebhookAsync(rawBody, dataId, idParam, xSignature, xRequestId);

        return result.Status switch
        {
            WebhookResultStatus.MissingSecret => Unauthorized(new { detail = result.Message }),
            WebhookResultStatus.InvalidSignature => Unauthorized(new { detail = result.Message }),
            WebhookResultStatus.AlreadyProcessed => Ok(new { status = "already_processed" }),
            WebhookResultStatus.Error => Ok(new { status = "error", message = result.Message }),
            _ => Ok(new { status = "received" })
        };
    }
}
