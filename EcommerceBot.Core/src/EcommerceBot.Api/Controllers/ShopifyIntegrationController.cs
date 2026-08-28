using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Api.Filters;
using EcommerceBot.Application.DTOs.Shopify;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Interfaces;
using EcommerceBot.Infrastructure.Options;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/shopify")]
public class ShopifyIntegrationController : BaseApiController
{
    private readonly IShopifyIntegrationService _shopifyService;
    private readonly IStoreIntegrationRepository _storeIntegrationRepository;
    private readonly IRedisService _redisService;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<ShopifyIntegrationController> _logger;
    private readonly string _clientSecret;

    public ShopifyIntegrationController(
        IShopifyIntegrationService shopifyService,
        IStoreIntegrationRepository storeIntegrationRepository,
        IRedisService redisService,
        IOptions<ShopifyOptions> shopifyOptions,
        IWebHostEnvironment env,
        ILogger<ShopifyIntegrationController> logger)
    {
        _shopifyService = shopifyService;
        _storeIntegrationRepository = storeIntegrationRepository;
        _redisService = redisService;
        _env = env;
        _logger = logger;
        _clientSecret = shopifyOptions.Value.ClientSecret ?? string.Empty;
    }

    [HttpPost("credentials")]
    public async Task<IActionResult> SaveCredentials(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromBody] ShopifyCredentialsPayloadDto payload)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header é obrigatório.");

        try
        {
            var result = await _shopifyService.SaveCredentialsAsync(activeTenantId, payload);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao salvar credenciais Shopify.");
            return StatusCode(500, new { error = "Erro interno ao salvar credenciais." });
        }
    }

    [HttpGet("auth")]
    public async Task<IActionResult> InitiateOAuth(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromQuery] string shop)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header é obrigatório.");

        if (string.IsNullOrWhiteSpace(shop))
            return BadRequest("Parâmetro 'shop' é obrigatório.");

        var authorizeUrl = await _shopifyService.GetOAuthUrlAsync(activeTenantId, shop);
        return Ok(new { authorize_url = authorizeUrl });
    }

    [HttpGet("oauth/callback")]
    [AllowAnonymous]
    public async Task<IActionResult> OAuthCallback(
        [FromQuery] string code,
        [FromQuery] string shop,
        [FromQuery] string? state,
        [FromQuery] string? hmac)
    {
        if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(shop))
        {
            return BadRequest("Missing code or shop parameter.");
        }

        if (!Guid.TryParse(state, out var tenantId) || tenantId == Guid.Empty)
        {
            return BadRequest("Invalid state/tenantId parameter.");
        }

        try
        {
            await _shopifyService.HandleOAuthCallbackAsync(tenantId, code, shop);
            return Ok(new { message = "OAuth concluído com sucesso!", shop, tenantId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro no callback OAuth da Shopify para a loja {Shop}", shop);
            return StatusCode(500, new { error = "Falha ao concluir autorização OAuth da Shopify." });
        }
    }

    [HttpPost("products")]
    public async Task<IActionResult> SyncProduct(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromBody] ShopifySyncRequestDto request)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header é obrigatório.");

        var result = await _shopifyService.SyncProductAsync(activeTenantId, request);
        return Ok(result);
    }

    [HttpPost("products/bulk-sync")]
    public async Task<IActionResult> TriggerBulkSync(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromBody] ShopifyBulkSyncRequestDto request)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header é obrigatório.");

        try
        {
            var result = await _shopifyService.TriggerBulkSyncAsync(activeTenantId, request);
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
        [FromBody] ShopifyInventoryUpdateDto payload)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header é obrigatório.");

        var result = await _shopifyService.UpdateInventoryAsync(activeTenantId, sku, payload);
        return Ok(result);
    }

    [HttpPatch("products/{sku}/status")]
    public async Task<IActionResult> UpdateStatus(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        string sku,
        [FromBody] ShopifyStatusUpdateDto payload)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header é obrigatório.");

        var result = await _shopifyService.UpdateStatusAsync(activeTenantId, sku, payload);
        return Ok(result);
    }

    [HttpDelete("products/{sku}")]
    public async Task<IActionResult> DeleteProduct(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        string sku)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID header é obrigatório.");

        var result = await _shopifyService.DeleteRemoteProductAsync(activeTenantId, sku);
        return Ok(result);
    }

    [HttpPost("webhooks")]
    [AllowAnonymous]
    [RateLimit(MaxRequests = 120, WindowSeconds = 60, BlockDurationSeconds = 300)]
    public async Task<IActionResult> ReceiveWebhook(
        [FromHeader(Name = "X-Shopify-Topic")] string topic,
        [FromHeader(Name = "X-Shopify-Shop-Domain")] string shopDomain,
        [FromHeader(Name = "X-Shopify-Hmac-Sha256")] string hmacSignature,
        [FromHeader(Name = "X-Shopify-Webhook-Id")] string? webhookId)
    {
        if (string.IsNullOrEmpty(topic) || string.IsNullOrEmpty(shopDomain) || string.IsNullOrEmpty(hmacSignature))
        {
            return BadRequest("Missing Shopify headers");
        }

        using var reader = new StreamReader(Request.Body);
        var rawBody = await reader.ReadToEndAsync();

        // 1. Validação Criptográfica de Assinatura HMAC SHA-256 em tempo constante
        if (!VerifyShopifySignature(rawBody, hmacSignature))
        {
            _logger.LogWarning("Invalid Shopify HMAC signature for domain {ShopDomain}", shopDomain);
            return Unauthorized("Invalid HMAC signature");
        }

        // 2. Idempotência no Redis (TTL 24 horas via SET NX conforme Regra 3.4 do AGENTS.md)
        var idempotencyId = !string.IsNullOrEmpty(webhookId) ? webhookId : Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawBody)))[..16];
        var idempotencyKey = $"webhook:shopify:{idempotencyId}";
        
        var isNew = await _redisService.SetIfNotExistsAsync(idempotencyKey, "processed", TimeSpan.FromHours(24));
        if (!isNew)
        {
            _logger.LogInformation("Shopify Webhook {WebhookId} already processed (idempotency hit).", idempotencyId);
            return Ok();
        }

        // 3. Resolução Multi-Tenant dinâmica por Domínio da Loja
        var cleanDomain = shopDomain.Replace("https://", "").Replace("http://", "").Trim().TrimEnd('/').ToLowerInvariant();
        var integration = await _storeIntegrationRepository.GetByDomainAsync("SHOPIFY", cleanDomain);
        if (integration == null)
        {
            _logger.LogWarning("No active Tenant found for Shopify domain '{ShopDomain}'. Webhook '{Topic}' ignored.", shopDomain, topic);
            return Ok();
        }

        try
        {
            var jsonPayload = JsonSerializer.Deserialize<JsonElement>(rawBody);
            await _shopifyService.ProcessWebhookAsync(integration.TenantId, topic, cleanDomain, jsonPayload);
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing Shopify webhook '{Topic}' for domain '{ShopDomain}'", topic, shopDomain);
            return StatusCode(500, "Internal error processing webhook");
        }
    }

    private bool VerifyShopifySignature(string rawBody, string hmacHeader)
    {
        if (string.IsNullOrEmpty(_clientSecret))
        {
            if (_env.IsDevelopment()) return true;
            _logger.LogError("Shopify:ClientSecret is not configured in production environment (Fail-Closed).");
            return false;
        }

        var keyBytes = Encoding.UTF8.GetBytes(_clientSecret);
        var messageBytes = Encoding.UTF8.GetBytes(rawBody);

        using var hmac = new HMACSHA256(keyBytes);
        var hash = hmac.ComputeHash(messageBytes);
        var calculatedSignature = Convert.ToBase64String(hash);

        var calculatedBytes = Encoding.UTF8.GetBytes(calculatedSignature);
        var headerBytes = Encoding.UTF8.GetBytes(hmacHeader);

        if (calculatedBytes.Length != headerBytes.Length)
            return false;

        return CryptographicOperations.FixedTimeEquals(calculatedBytes, headerBytes);
    }
}
