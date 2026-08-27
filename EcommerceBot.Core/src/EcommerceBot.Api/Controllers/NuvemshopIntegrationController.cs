using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Api.Filters;
using EcommerceBot.Application.DTOs.Nuvemshop;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/nuvemshop")]
public class NuvemshopIntegrationController : BaseApiController
{
    private readonly INuvemshopIntegrationService _nuvemshopService;
    private readonly IStoreIntegrationRepository _storeIntegrationRepository;
    private readonly IRedisService _redisService;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<NuvemshopIntegrationController> _logger;
    private readonly string _clientSecret;

    public NuvemshopIntegrationController(
        INuvemshopIntegrationService nuvemshopService,
        IStoreIntegrationRepository storeIntegrationRepository,
        IRedisService redisService,
        IConfiguration config,
        IWebHostEnvironment env,
        ILogger<NuvemshopIntegrationController> logger)
    {
        _nuvemshopService = nuvemshopService;
        _storeIntegrationRepository = storeIntegrationRepository;
        _redisService = redisService;
        _env = env;
        _logger = logger;
        _clientSecret = config["Nuvemshop:ClientSecret"] ?? string.Empty;
    }

    [HttpGet("auth")]
    public IActionResult GetOAuthUrl([FromHeader(Name = "X-Tenant-ID")] Guid tenantId)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header é obrigatório.");

        var url = _nuvemshopService.GetOAuthUrl(activeTenantId);
        return Ok(new { url });
    }

    [HttpPost("credentials")]
    public async Task<IActionResult> SaveCredentials(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromBody] NuvemshopCredentialsPayloadDto payload)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header é obrigatório.");

        try
        {
            var success = await _nuvemshopService.SaveCredentialsAsync(activeTenantId, payload);
            return Ok(new { success, message = "Credenciais da Nuvemshop salvas e validadas com sucesso." });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao salvar credenciais da Nuvemshop para Tenant {TenantId}", activeTenantId);
            return StatusCode(500, new { error = "Falha interna ao salvar credenciais da Nuvemshop." });
        }
    }

    [HttpGet("oauth/callback")]
    [AllowAnonymous]
    public async Task<IActionResult> OAuthCallback([FromQuery] string code, [FromQuery] string state)
    {
        if (!Guid.TryParse(state, out var tenantId) || string.IsNullOrEmpty(code))
        {
            return BadRequest("Parâmetros code e state são obrigatórios.");
        }

        var success = await _nuvemshopService.HandleOAuthCallbackAsync(tenantId, code);
        if (!success)
        {
            return StatusCode(500, new { error = "Falha ao autorizar aplicativo na Nuvemshop." });
        }

        return Ok(new { message = "Loja Nuvemshop conectada com sucesso via OAuth 2.0!" });
    }

    [HttpPost("webhooks")]
    [AllowAnonymous]
    [RateLimit(MaxRequests = 120, WindowSeconds = 60, BlockDurationSeconds = 300)]
    public async Task<IActionResult> ReceiveWebhook(
        [FromHeader(Name = "X-LinkedStore-Topic")] string topic,
        [FromHeader(Name = "X-LinkedStore-HMAC-SHA256")] string hmacSignature,
        [FromHeader(Name = "X-LinkedStore-Store-Id")] string? storeIdHeader,
        [FromHeader(Name = "X-LinkedStore-Event-Id")] string? eventId)
    {
        if (string.IsNullOrEmpty(topic) || string.IsNullOrEmpty(hmacSignature))
        {
            return BadRequest("Cabeçalhos de Webhook da Nuvemshop ausentes.");
        }

        using var reader = new StreamReader(Request.Body);
        var rawBody = await reader.ReadToEndAsync();

        // 1. Validação Criptográfica de Assinatura HMAC SHA-256 em tempo constante
        if (!VerifyNuvemshopSignature(rawBody, hmacSignature))
        {
            _logger.LogWarning("Assinatura HMAC da Nuvemshop inválida");
            return Unauthorized("Invalid HMAC signature");
        }

        // 2. Idempotência no Redis (TTL 24 horas via SET NX conforme Regra 3.4 do AGENTS.md)
        var idempotencyId = !string.IsNullOrEmpty(eventId) ? eventId : Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawBody)))[..16];
        var idempotencyKey = $"webhook:nuvemshop:{idempotencyId}";

        var isNew = await _redisService.SetIfNotExistsAsync(idempotencyKey, "processed", TimeSpan.FromHours(24));
        if (!isNew)
        {
            _logger.LogInformation("Nuvemshop Webhook {EventId} already processed (idempotency hit).", idempotencyId);
            return Ok();
        }

        // 3. Resolução Multi-Tenant dinâmica por Store ID
        var storeDomain = storeIdHeader?.Trim() ?? "";
        var integration = !string.IsNullOrEmpty(storeDomain)
            ? await _storeIntegrationRepository.GetByDomainAsync("NUVEMSHOP", storeDomain)
            : null;

        if (integration == null)
        {
            _logger.LogWarning("Nenhuma integração ativa encontrada para o Store ID '{StoreId}' da Nuvemshop.", storeDomain);
            return Ok();
        }

        try
        {
            var jsonPayload = JsonSerializer.Deserialize<JsonElement>(rawBody);
            await _nuvemshopService.ProcessWebhookAsync(integration.TenantId, topic, idempotencyId, jsonPayload);
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar webhook da Nuvemshop '{Topic}' para Store ID '{StoreId}'", topic, storeDomain);
            return StatusCode(500, "Erro interno no processamento do webhook");
        }
    }

    [HttpPost("sync/bulk")]
    public async Task<IActionResult> TriggerBulkSync(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromBody] NuvemshopBulkSyncRequest request)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header é obrigatório.");

        try
        {
            var result = await _nuvemshopService.TriggerBulkSyncAsync(activeTenantId, request);
            return Accepted(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPatch("products/{sku}/inventory")]
    public async Task<IActionResult> UpdateInventory(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        string sku,
        [FromBody] JsonElement body)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header é obrigatório.");

        if (!body.TryGetProperty("quantity", out var qtyElem) || !qtyElem.TryGetInt32(out var qty))
            return BadRequest("Campo 'quantity' (int) é obrigatório.");

        var result = await _nuvemshopService.UpdateInventoryAsync(activeTenantId, sku, qty);
        return Ok(new { success = result });
    }

    [HttpPatch("products/{sku}/status")]
    public async Task<IActionResult> UpdateStatus(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        string sku,
        [FromBody] JsonElement body)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header é obrigatório.");

        var status = body.TryGetProperty("status", out var statusElem) ? statusElem.GetString() ?? "ACTIVE" : "ACTIVE";
        var result = await _nuvemshopService.UpdateProductStatusAsync(activeTenantId, sku, status);
        return Ok(new { success = result });
    }

    [HttpDelete("products/{sku}")]
    public async Task<IActionResult> DeleteProduct(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        string sku)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header é obrigatório.");

        var result = await _nuvemshopService.DeleteRemoteProductAsync(activeTenantId, sku);
        return Ok(new { success = result });
    }

    private bool VerifyNuvemshopSignature(string rawBody, string hmacHeader)
    {
        if (string.IsNullOrEmpty(_clientSecret))
        {
            if (_env.IsDevelopment()) return true;
            _logger.LogError("Nuvemshop:ClientSecret não configurado em ambiente de produção (Fail-Closed).");
            return false;
        }

        var keyBytes = Encoding.UTF8.GetBytes(_clientSecret);
        var messageBytes = Encoding.UTF8.GetBytes(rawBody);

        using var hmac = new HMACSHA256(keyBytes);
        var hash = hmac.ComputeHash(messageBytes);
        var calculatedSignature = Convert.ToHexString(hash).ToLowerInvariant();

        var calculatedBytes = Encoding.UTF8.GetBytes(calculatedSignature);
        var headerBytes = Encoding.UTF8.GetBytes(hmacHeader.Trim().ToLowerInvariant());

        if (calculatedBytes.Length != headerBytes.Length)
            return false;

        return CryptographicOperations.FixedTimeEquals(calculatedBytes, headerBytes);
    }
}
