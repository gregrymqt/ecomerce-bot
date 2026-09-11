using System;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Messaging;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Interfaces;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Messaging;

public sealed class ProcessedProductConsumer : IConsumer<ProductProcessedEvent>
{
    private readonly IProductRepository _productRepository;
    private readonly ITenantRepository _tenantRepository;
    private readonly IRedisService _redisService;
    private readonly ILogger<ProcessedProductConsumer> _logger;

    public ProcessedProductConsumer(
        IProductRepository productRepository,
        ITenantRepository tenantRepository,
        IRedisService redisService,
        ILogger<ProcessedProductConsumer> logger)
    {
        _productRepository = productRepository;
        _tenantRepository = tenantRepository;
        _redisService = redisService;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<ProductProcessedEvent> context)
    {
        var message = context.Message;
        _logger.LogInformation("Recebido ProductProcessedEvent para Tenant {TenantId}, SKU {Sku}. Status: {Status}",
            message.TenantId, message.Sku, message.Status);

        // Update no banco de dados via Dapper
        await _productRepository.UpdateStatusAsync(
            tenantId: message.TenantId,
            sku: message.Sku,
            status: message.Status,
            metadata: message.AiMetadataJson,
            cancellationToken: context.CancellationToken
        );

        var isFailed = string.Equals(message.Status, "FAILED", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(message.Status, "ERROR", StringComparison.OrdinalIgnoreCase);

        // Notificar o Frontend em tempo real via SSE (Redis Pub/Sub)
        var channel = $"events:tenant:{message.TenantId}";

        string ssePayload;
        if (!isFailed)
        {
            string priceStr = "R$ 0,00";
            string category = "Geral";
            string imageUrl = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80";

            try
            {
                if (!string.IsNullOrWhiteSpace(message.AiMetadataJson))
                {
                    using var doc = JsonDocument.Parse(message.AiMetadataJson);
                    var root = doc.RootElement;
                    if (root.TryGetProperty("price", out var pProp) && pProp.GetDouble() > 0)
                    {
                        priceStr = $"R$ {pProp.GetDouble():F2}";
                    }
                    if (root.TryGetProperty("category", out var cProp) && !string.IsNullOrWhiteSpace(cProp.GetString()))
                    {
                        category = cProp.GetString()!;
                    }
                    if (root.TryGetProperty("images", out var iProp) && iProp.ValueKind == JsonValueKind.Array && iProp.GetArrayLength() > 0)
                    {
                        var firstImg = iProp[0].GetString();
                        if (!string.IsNullOrWhiteSpace(firstImg))
                            imageUrl = firstImg;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao deserializar AiMetadataJson para Tenant {TenantId}", message.TenantId);
            }

            ssePayload = JsonSerializer.Serialize(new
            {
                type = "product_processed",
                sku = message.Sku,
                status = "PROCESSED",
                isFallback = false,
                progress = 100,
                log = new
                {
                    id = $"log-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
                    timestamp = DateTimeOffset.UtcNow.ToString("HH:mm:ss"),
                    level = "SUCCESS",
                    message = "Catálogo enriquecido com sucesso! Resultado pronto para publicação."
                },
                result = new
                {
                    titleOriginal = message.Title,
                    titleMagnetic = message.Title,
                    tone = "Persuasivo & Tecnológico",
                    category = category,
                    seoScore = 95,
                    bulletPoints = new[]
                    {
                        string.IsNullOrWhiteSpace(message.Description) ? "Produto processado com inteligência artificial." : message.Description
                    },
                    price = priceStr,
                    imageUrl = imageUrl,
                    rawJson = new
                    {
                        sku = message.Sku,
                        title = message.Title,
                        description = message.Description,
                        metadata = message.AiMetadataJson
                    }
                }
            });
        }
        else
        {
            var errDetail = !string.IsNullOrWhiteSpace(message.ErrorMessage)
                ? message.ErrorMessage
                : "Falha de rede ou DNS durante a extração do catálogo.";

            ssePayload = JsonSerializer.Serialize(new
            {
                type = "product_processed",
                sku = message.Sku,
                status = "FAILED",
                isFallback = true,
                errorMessage = errDetail,
                progress = 100,
                log = new
                {
                    id = $"log-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
                    timestamp = DateTimeOffset.UtcNow.ToString("HH:mm:ss"),
                    level = "ERROR",
                    message = $"Falha na extração: {errDetail}"
                }
            });
        }

        await _redisService.PublishAsync(channel, ssePayload);

        // Se o processamento do Worker falhou ou retornou erro, estorna o crédito deduzido atomicamente
        if (isFailed)
        {
            _logger.LogWarning("Extração com erro para Tenant {TenantId}, SKU {Sku}. Motivo: {ErrorMessage}. Executando estorno de 1 crédito no Ledger.",
                message.TenantId, message.Sku, message.ErrorMessage);

            var newBalance = await _tenantRepository.AddCreditsAsync(
                tenantId: message.TenantId,
                amount: 1,
                type: "REFUND",
                description: $"Estorno automático por falha na extração de produto (SKU: {message.Sku})",
                referenceId: message.Sku,
                cancellationToken: context.CancellationToken
            );

            var refundPayload = JsonSerializer.Serialize(new
            {
                type = "credits_refunded",
                sku = message.Sku,
                amount = 1,
                balance_credits = newBalance,
                timestamp = DateTimeOffset.UtcNow
            });

            await _redisService.PublishAsync(channel, refundPayload);
        }
    }
}
