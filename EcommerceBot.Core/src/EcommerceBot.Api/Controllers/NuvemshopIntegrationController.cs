using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Nuvemshop;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using MassTransit;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Api.Controllers
{
    [ApiController]
    [Route("api/v1/nuvemshop")]
    public class NuvemshopIntegrationController : ControllerBase
    {
        private readonly IPublishEndpoint _publishEndpoint;
        private readonly ITenantAiCredentialRepository _credentialRepository;
        private readonly ILogger<NuvemshopIntegrationController> _logger;

        public NuvemshopIntegrationController(
            IPublishEndpoint publishEndpoint,
            ITenantAiCredentialRepository credentialRepository,
            ILogger<NuvemshopIntegrationController> logger)
        {
            _publishEndpoint = publishEndpoint;
            _credentialRepository = credentialRepository;
            _logger = logger;
        }

        [HttpGet("oauth/callback")]
        public async Task<IActionResult> OAuthCallback([FromQuery] string code, [FromQuery] string state)
        {
            // O state geralmente contém o TenantId e uma assinatura de segurança
            if (!Guid.TryParse(state, out var tenantId))
            {
                return BadRequest("Invalid state parameter");
            }

            _logger.LogInformation("Receiving Nuvemshop OAuth callback for Tenant {TenantId} with code {Code}", tenantId, code);

            // Neste ponto seria feita a troca do code por um access_token através de um HttpClient.
            // Para efeitos de migração do boilerplate, vamos considerar que o token foi recebido:
            string mockToken = "ns_" + Guid.NewGuid().ToString("N");
            string mockStoreId = "123456";

            // Salva a credencial
            // ... (implementação com CryptoService e repositório)
            _logger.LogInformation("Saved Nuvemshop credentials for Tenant {TenantId}", tenantId);

            return Ok(new { message = "Nuvemshop connected successfully!" });
        }

        [HttpPost("webhooks/{tenantId}")]
        public IActionResult ReceiveWebhook(Guid tenantId, [FromBody] object payload)
        {
            if (tenantId == Guid.Empty)
                return BadRequest("Invalid tenantId");

            // Processa webhooks de pedidos ou produtos modificados na Nuvemshop
            _logger.LogInformation("Received Nuvemshop Webhook for Tenant {TenantId}", tenantId);
            return Ok();
        }

        [HttpPost("sync/bulk")]
        [Microsoft.AspNetCore.Authorization.Authorize]
        public async Task<IActionResult> TriggerBulkSync([FromHeader(Name = "X-Tenant-ID")] Guid tenantId, [FromBody] NuvemshopBulkSyncRequest request)
        {
            if (tenantId == Guid.Empty)
                return BadRequest("X-Tenant-ID header is required.");

            if (request.Skus == null || request.Skus.Count == 0)
                return BadRequest("Skus list cannot be empty.");

            var jobId = Guid.NewGuid().ToString("N");

            foreach (var sku in request.Skus)
            {
                var msg = new NuvemshopBulkSyncMessage
                {
                    JobId = jobId,
                    TenantId = tenantId,
                    Sku = sku,
                    ForceUpdate = request.ForceUpdate,
                    Visibility = request.Visibility
                };

                // Envia para o RabbitMQ via MassTransit
                await _publishEndpoint.Publish(msg, context => 
                {
                    context.SetRoutingKey("nuvemshop_bulk_sync");
                });
            }

            _logger.LogInformation("Enqueued {Count} products for Nuvemshop sync. JobId: {JobId}", request.Skus.Count, jobId);

            return Accepted(new { 
                job_id = jobId, 
                total_enqueued = request.Skus.Count, 
                status = "queued",
                message = "Sync job started" 
            });
        }
    }
}
