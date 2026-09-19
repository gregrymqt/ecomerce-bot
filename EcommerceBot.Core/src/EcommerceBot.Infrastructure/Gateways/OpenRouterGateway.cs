using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Ai;
using EcommerceBot.Application.Interfaces.Gateways;
using EcommerceBot.Application.Interfaces.Services;
using EcommerceBot.Domain.Services;
using EcommerceBot.Infrastructure.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EcommerceBot.Infrastructure.Gateways;

/// <summary>
/// Orquestrador de alto nível para enriquecimento persuasivo de produtos via OpenRouter.
/// Coordena o pipeline de engenharia de prompt, inferência HTTP com resiliência, parsing defensivo e medição de custos.
/// </summary>
public sealed class OpenRouterGateway : IOpenRouterGateway
{
    private readonly IOpenRouterClient _client;
    private readonly IProductEnrichmentPromptService _promptService;
    private readonly ILlmContentParserService _contentParser;
    private readonly OpenRouterOptions _options;
    private readonly ILogger<OpenRouterGateway> _logger;

    public OpenRouterGateway(
        IOpenRouterClient client,
        IProductEnrichmentPromptService promptService,
        ILlmContentParserService contentParser,
        IOptions<OpenRouterOptions> options,
        ILogger<OpenRouterGateway> logger)
    {
        _client = client;
        _promptService = promptService;
        _contentParser = contentParser;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<ProductEnrichmentLlmResponse> EnrichProductAsync(
        ProductEnrichmentLlmRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var effectiveApiKey = _options.ApiKey;

        if (string.IsNullOrWhiteSpace(effectiveApiKey))
        {
            throw new InvalidOperationException("OpenRouter API key is not configured in OpenRouterOptions.");
        }

        var modelToUse = !string.IsNullOrWhiteSpace(request.CustomModel)
            ? request.CustomModel
            : (!string.IsNullOrWhiteSpace(_options.DefaultModel) ? _options.DefaultModel : "deepseek/deepseek-chat");

        var stopwatch = Stopwatch.StartNew();

        try
        {
            var promptRequest = _promptService.BuildPromptRequest(request, modelToUse);

            _logger.LogInformation(
                "[OpenRouterGateway] Iniciando enriquecimento do SKU: {Sku} | Tenant: {TenantId} | Modelo: {Model}",
                request.Sku,
                request.TenantId,
                modelToUse);

            var completionResponse = await _client.CreateChatCompletionAsync(promptRequest, effectiveApiKey, cancellationToken);

            if (completionResponse?.Error != null)
            {
                var errorMsg = $"OpenRouter API error: {completionResponse.Error.Message} (Code: {completionResponse.Error.Code})";
                _logger.LogWarning("[OpenRouterGateway] {Error} para SKU: {Sku}", errorMsg, request.Sku);
                return BuildFallbackResponse(request, errorMsg, modelToUse);
            }

            if (completionResponse?.Choices == null || completionResponse.Choices.Count == 0)
            {
                _logger.LogWarning("[OpenRouterGateway] Choices vazias retornadas para SKU: {Sku}", request.Sku);
                return BuildFallbackResponse(request, "OpenRouter retornou lista de choices vazia.", modelToUse);
            }

            var assistantContent = completionResponse.Choices[0].Message?.Content;
            if (string.IsNullOrWhiteSpace(assistantContent))
            {
                _logger.LogWarning("[OpenRouterGateway] Mensagem do assistente veio vazia para SKU: {Sku}", request.Sku);
                return BuildFallbackResponse(request, "Assistente retornou mensagem vazia.", modelToUse);
            }

            var parsedContent = _contentParser.ParseContent(assistantContent);
            if (parsedContent == null)
            {
                _logger.LogWarning("[OpenRouterGateway] Falha no parsing do JSON gerado para SKU: {Sku}", request.Sku);
                return BuildFallbackResponse(request, "Falha ao converter saída JSON do modelo.", modelToUse);
            }

            var promptTokens = completionResponse.Usage?.PromptTokens ?? 0;
            var completionTokens = completionResponse.Usage?.CompletionTokens ?? 0;
            var totalCost = LlmPricingCalculator.CalculateCost(modelToUse, promptTokens, completionTokens);

            stopwatch.Stop();
            _logger.LogInformation(
                "[OpenRouterGateway] SKU {Sku} enriquecido com sucesso em {ElapsedMs}ms | Tokens: {Prompt}+{Completion} | Custo: ${Cost:F6}",
                request.Sku,
                stopwatch.ElapsedMilliseconds,
                promptTokens,
                completionTokens,
                totalCost);

            var faqs = new List<ProductFaqItem>();
            if (parsedContent.Faqs != null)
            {
                foreach (var faq in parsedContent.Faqs)
                {
                    if (!string.IsNullOrWhiteSpace(faq.Question) && !string.IsNullOrWhiteSpace(faq.Answer))
                    {
                        faqs.Add(new ProductFaqItem(faq.Question.Trim(), faq.Answer.Trim()));
                    }
                }
            }

            return new ProductEnrichmentLlmResponse
            {
                Title = !string.IsNullOrWhiteSpace(parsedContent.Title)
                    ? parsedContent.Title.Trim()
                    : (request.RawTitle ?? request.Sku),
                Description = !string.IsNullOrWhiteSpace(parsedContent.Description)
                    ? parsedContent.Description.Trim()
                    : (request.RawMarkdown ?? request.RawDescriptionHtml),
                BulletPoints = parsedContent.BulletPoints ?? new List<string>(),
                SeoKeywords = parsedContent.SeoKeywords ?? new List<string>(),
                Faqs = faqs,
                PromptTokens = promptTokens,
                CompletionTokens = completionTokens,
                TotalCostEstimated = totalCost,
                ModelUsed = modelToUse,
                IsFallback = false,
                ErrorMessage = null
            };
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            stopwatch.Stop();
            _logger.LogError(
                ex,
                "[OpenRouterGateway] Erro não tratado no enriquecimento do SKU: {Sku} após {ElapsedMs}ms",
                request.Sku,
                stopwatch.ElapsedMilliseconds);

            return BuildFallbackResponse(request, ex.Message, modelToUse);
        }
    }

    private static ProductEnrichmentLlmResponse BuildFallbackResponse(
        ProductEnrichmentLlmRequest request,
        string errorMessage,
        string modelUsed)
    {
        var fallbackTitle = !string.IsNullOrWhiteSpace(request.RawTitle)
            ? request.RawTitle
            : request.Sku;

        var fallbackDesc = !string.IsNullOrWhiteSpace(request.RawMarkdown)
            ? request.RawMarkdown
            : (!string.IsNullOrWhiteSpace(request.RawDescriptionHtml) ? request.RawDescriptionHtml : fallbackTitle);

        return new ProductEnrichmentLlmResponse
        {
            Title = fallbackTitle,
            Description = fallbackDesc,
            BulletPoints = new List<string>(),
            SeoKeywords = new List<string>(),
            Faqs = new List<ProductFaqItem>(),
            PromptTokens = 0,
            CompletionTokens = 0,
            TotalCostEstimated = 0m,
            ModelUsed = modelUsed,
            IsFallback = true,
            ErrorMessage = errorMessage
        };
    }
}
