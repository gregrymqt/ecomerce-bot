using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Api.Filters;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/shopify")]
public class ShopifyIntegrationController : BaseApiController
{
    private readonly IShopifyIntegrationService _shopifyService;
    private readonly ILogger<ShopifyIntegrationController> _logger;
    private readonly string _clientSecret;

    public ShopifyIntegrationController(
        IShopifyIntegrationService shopifyService,
        ILogger<ShopifyIntegrationController> logger,
        IConfiguration config)
    {
        _shopifyService = shopifyService;
        _logger = logger;
        _clientSecret = config["Shopify:ClientSecret"] ?? string.Empty;
    }

    [HttpPost("webhooks")]
    [AllowAnonymous]
    [RateLimit(MaxRequests = 120, WindowSeconds = 60, BlockDurationSeconds = 300)]
    public async Task<IActionResult> ReceiveWebhook(
        [FromHeader(Name = "X-Shopify-Topic")] string topic,
        [FromHeader(Name = "X-Shopify-Shop-Domain")] string shopDomain,
        [FromHeader(Name = "X-Shopify-Hmac-Sha256")] string hmacSignature,
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId)
    {
        if (string.IsNullOrEmpty(topic) || string.IsNullOrEmpty(shopDomain) || string.IsNullOrEmpty(hmacSignature))
        {
            return BadRequest("Missing Shopify headers");
        }

        using var reader = new StreamReader(Request.Body);
        var rawBody = await reader.ReadToEndAsync();

        if (!VerifyShopifySignature(rawBody, hmacSignature))
        {
            _logger.LogWarning("Invalid Shopify HMAC signature for domain {ShopDomain}", shopDomain);
            return Unauthorized("Invalid HMAC signature");
        }

        try
        {
            var jsonPayload = JsonSerializer.Deserialize<JsonElement>(rawBody);
            await _shopifyService.ProcessWebhookAsync(tenantId, topic, shopDomain, jsonPayload);
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing Shopify webhook");
            return StatusCode(500, "Internal error processing webhook");
        }
    }

    [HttpGet("oauth/callback")]
    [AllowAnonymous]
    public async Task<IActionResult> OAuthCallback(
        [FromQuery] string code,
        [FromQuery] string shop,
        [FromQuery] string hmac,
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId)
    {
        if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(shop))
        {
            return BadRequest("Missing code or shop parameter.");
        }

        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        await _shopifyService.HandleOAuthCallbackAsync(activeTenantId, code, shop);

        return Ok(new { message = "OAuth concluído com sucesso." });
    }

    private bool VerifyShopifySignature(string rawBody, string hmacHeader)
    {
        if (string.IsNullOrEmpty(_clientSecret)) return false;

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
