using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using EcommerceBot.Domain.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Api.Controllers
{
    [ApiController]
    [Route("api/v1/webhooks/mercadopago")]
    public class MercadoPagoWebhookController : ControllerBase
    {
        private readonly IOrderRepository _orderRepository;
        private readonly ILogger<MercadoPagoWebhookController> _logger;
        private readonly string? _webhookSecret;

        private static readonly Regex TsV1Regex = new Regex(@"(?:ts=(?<ts>\d+))|(?:v1=(?<v1>[a-fA-F0-9]+))", RegexOptions.Compiled);

        public MercadoPagoWebhookController(IOrderRepository orderRepository, IConfiguration configuration, ILogger<MercadoPagoWebhookController> logger)
        {
            _orderRepository = orderRepository;
            _logger = logger;
            _webhookSecret = configuration["MercadoPago:WebhookSecret"];
        }

        [HttpPost]
        public async Task<IActionResult> ReceiveWebhook(
            [FromQuery(Name = "data.id")] string? dataId,
            [FromQuery(Name = "id")] string? idParam,
            [FromHeader(Name = "x-signature")] string? xSignature,
            [FromHeader(Name = "x-request-id")] string? xRequestId)
        {
            try
            {
                using var reader = new StreamReader(Request.Body, Encoding.UTF8);
                var rawBody = await reader.ReadToEndAsync();
                
                var resourceId = dataId ?? idParam ?? "";

                if (!string.IsNullOrEmpty(_webhookSecret))
                {
                    if (string.IsNullOrEmpty(xSignature) || !VerifySignature(xSignature, xRequestId, resourceId, _webhookSecret))
                    {
                        _logger.LogWarning("Invalid or missing Mercado Pago webhook signature.");
                        return Unauthorized(new { detail = "Invalid webhook signature." });
                    }
                }
                else
                {
                    _logger.LogWarning("MercadoPago:WebhookSecret is not configured. Skipping signature verification.");
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
                string action = string.Empty;
                
                if (root.TryGetProperty("action", out var actionElement))
                {
                    action = actionElement.GetString() ?? string.Empty;
                }
                else if (root.TryGetProperty("type", out var typeElement))
                {
                    action = typeElement.GetString() ?? string.Empty;
                }

                _logger.LogInformation("Processing Mercado Pago webhook action: {Action}, resource_id: {ResourceId}", action, resourceId);

                // Handling payments and orders
                if (action.StartsWith("payment.") || action.StartsWith("order."))
                {
                    // Na prática, buscaríamos a Order pelo tenant e atualizaríamos o status.
                    // Como webhooks chegam sem X-Tenant-ID confiável (às vezes no payload),
                    // precisamos buscar pelo external_reference ou pelo MpPaymentId que o Checkout Service gerou.
                    
                    // TODO: A modelagem Dapper do GetOrderByIdAsync requer TenantId. Precisaremos de um 
                    // método no repositório para buscar a order independente do Tenant se baseando no MpPaymentId 
                    // se conectarmos a API real do MP.
                    _logger.LogInformation("Payment/Order event {Action} recorded for {ResourceId}", action, resourceId);
                }
                else if (action.StartsWith("subscription"))
                {
                    _logger.LogInformation("Subscription event {Action} recorded for {ResourceId}", action, resourceId);
                }
                else
                {
                    _logger.LogInformation("Ignored unmapped event {Action} for {ResourceId}", action, resourceId);
                }

                return Ok(new { status = "received" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process Mercado Pago webhook");
                // Sempre retorna 200 pro MP não ficar reenviando se for erro interno de processamento
                return Ok(new { status = "error", message = "Processed defensively" });
            }
        }

        private bool VerifySignature(string xSignature, string? xRequestId, string dataId, string secret)
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

            // Constant-time compare
            return CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(computedHash),
                Encoding.UTF8.GetBytes(v1.ToLower()));
        }
    }
}
