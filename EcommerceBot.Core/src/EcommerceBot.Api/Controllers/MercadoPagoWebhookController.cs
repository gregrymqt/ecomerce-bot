using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Api.Controllers;

[ApiController]
[Route("api/v1/webhooks/mercadopago")]
public class MercadoPagoWebhookController : ControllerBase
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
