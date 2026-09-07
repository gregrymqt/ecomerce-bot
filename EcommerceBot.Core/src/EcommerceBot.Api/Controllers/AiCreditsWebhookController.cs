using System;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Api.Filters;
using EcommerceBot.Application.DTOs.Analytics;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Api.Controllers;

public sealed record AiCreditsWebhookPayload
{
    [JsonPropertyName("amount_paid")]
    public decimal AmountPaid { get; init; }

    [JsonPropertyName("currency")]
    public string Currency { get; init; } = "USD";

    [JsonPropertyName("tokens_credited")]
    public long TokensCredited { get; init; }

    [JsonPropertyName("transaction_id")]
    public string? TransactionId { get; init; }

    [JsonPropertyName("notes")]
    public string? Notes { get; init; }
}

[ApiController]
[Route("api/v1/webhooks/ai-credits")]
[AllowAnonymous]
[RateLimit(MaxRequests = 60, WindowSeconds = 60, BlockDurationSeconds = 300)]
public class AiCreditsWebhookController : BaseApiController
{
    private readonly IAiCapacityService _aiCapacityService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AiCreditsWebhookController> _logger;

    public AiCreditsWebhookController(
        IAiCapacityService aiCapacityService,
        IConfiguration configuration,
        ILogger<AiCreditsWebhookController> logger)
    {
        _aiCapacityService = aiCapacityService;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Endpoint seguro de recepção de recargas de saldo de IA por provedor (DEEPSEEK, GEMINI, OPENROUTER).
    /// </summary>
    [HttpPost("{provider}")]
    public async Task<IActionResult> ReceiveCreditTopup(
        [FromRoute] string provider,
        [FromBody] AiCreditsWebhookPayload payload,
        [FromHeader(Name = "X-Webhook-Secret")] string? headerSecret,
        [FromQuery(Name = "secret")] string? querySecret,
        CancellationToken cancellationToken = default)
    {
        var incomingSecret = headerSecret ?? querySecret;

        // Recupera o segredo configurado sem fallbacks estáticos inseguros (fail-closed)
        var expectedSecret = _configuration["Webhooks:AiCreditsSecret"]
            ?? _configuration["WEBHOOK_AI_CREDITS_SECRET"]
            ?? _configuration["Jwt:SecretKey"]
            ?? throw new InvalidOperationException("Segredo de webhook de créditos de IA não configurado no servidor.");

        if (string.IsNullOrWhiteSpace(incomingSecret))
        {
            _logger.LogWarning("Tentativa de chamada ao webhook de créditos de IA sem segredo fornecido.");
            return UnauthorizedProblem("Cabeçalho X-Webhook-Secret ausente.");
        }

        var incomingBytes = Encoding.UTF8.GetBytes(incomingSecret);
        var expectedBytes = Encoding.UTF8.GetBytes(expectedSecret);

        if (incomingBytes.Length != expectedBytes.Length ||
            !CryptographicOperations.FixedTimeEquals(incomingBytes, expectedBytes))
        {
            _logger.LogWarning("Segredo do webhook de créditos de IA inválido para provedor {Provider}.", provider);
            return UnauthorizedProblem("Segredo do webhook inválido.");
        }

        if (payload.AmountPaid <= 0)
        {
            return BadRequestProblem("O campo amount_paid deve ser maior que zero.");
        }

        var topupRequest = new AiProviderCreditTopupRequest
        {
            Provider = provider,
            AmountPaid = payload.AmountPaid,
            Currency = payload.Currency,
            TokensCredited = payload.TokensCredited,
            TransactionReference = payload.TransactionId,
            Source = "WEBHOOK",
            Notes = payload.Notes
        };

        var created = await _aiCapacityService.RegisterTopupAsync(topupRequest);

        _logger.LogInformation("Webhook de recarga processado com sucesso: {Provider} +${Amount} (ID: {Id})",
            provider, payload.AmountPaid, created.Id);

        return Ok(new
        {
            status = "processed",
            id = created.Id,
            provider = created.Provider,
            amount_paid = created.AmountPaid,
            balance_remaining = created.BalanceRemaining
        });
    }
}
