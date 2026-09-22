using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Ai;
using EcommerceBot.Application.DTOs.OpenRouter;
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

        var primaryModel = !string.IsNullOrWhiteSpace(request.CustomModel)
            ? request.CustomModel
            : (!string.IsNullOrWhiteSpace(_options.DefaultModel) ? _options.DefaultModel : "deepseek/deepseek-chat");

        var fallbackModel = !string.IsNullOrWhiteSpace(_options.FallbackModel) ? _options.FallbackModel : null;

        var stopwatch = Stopwatch.StartNew();
        var modelToUse = primaryModel;

        try
        {
            OpenRouterChatCompletionResponse? completionResponse = null;
            string? failureReason = null;

            try
            {
                var promptRequest = _promptService.BuildPromptRequest(request, primaryModel);

                _logger.LogInformation(
                    "[OpenRouterGateway] Iniciando enriquecimento do SKU: {Sku} | Tenant: {TenantId} | Modelo: {Model}",
                    request.Sku,
                    request.TenantId,
                    primaryModel);

                completionResponse = await _client.CreateChatCompletionAsync(promptRequest, effectiveApiKey, cancellationToken);

                if (completionResponse?.Error != null)
                {
                    failureReason = $"OpenRouter API error: {completionResponse.Error.Message} (Code: {completionResponse.Error.Code})";
                }
                else if (completionResponse?.Choices == null || completionResponse.Choices.Count == 0)
                {
                    failureReason = "OpenRouter retornou lista de choices vazia.";
                }
                else if (string.IsNullOrWhiteSpace(completionResponse.Choices[0].Message?.Content))
                {
                    failureReason = "Assistente retornou mensagem vazia.";
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                failureReason = ex.Message;
                _logger.LogWarning(ex, "[OpenRouterGateway] Exceção durante chamada ao modelo primário ({Primary}) para SKU: {Sku}", primaryModel, request.Sku);
            }

            // Chaveamento para Fallback Model se a chamada primária falhou
            if (failureReason != null && !string.IsNullOrWhiteSpace(fallbackModel) && !string.Equals(fallbackModel, primaryModel, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning(
                    "[OpenRouterGateway] Falha no modelo primário ({Primary}). Acionando modelo secundário ({Fallback}) para SKU {Sku}",
                    primaryModel,
                    _options.FallbackModel,
                    request.Sku);

                try
                {
                    var fallbackPromptRequest = _promptService.BuildPromptRequest(request, fallbackModel);
                    completionResponse = await _client.CreateChatCompletionAsync(fallbackPromptRequest, effectiveApiKey, cancellationToken);
                    modelToUse = fallbackModel;
                    failureReason = null;

                    if (completionResponse?.Error != null)
                    {
                        failureReason = $"Fallback OpenRouter API error: {completionResponse.Error.Message} (Code: {completionResponse.Error.Code})";
                    }
                    else if (completionResponse?.Choices == null || completionResponse.Choices.Count == 0)
                    {
                        failureReason = "Fallback OpenRouter retornou lista de choices vazia.";
                    }
                    else if (string.IsNullOrWhiteSpace(completionResponse.Choices[0].Message?.Content))
                    {
                        failureReason = "Fallback Assistente retornou mensagem vazia.";
                    }
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    failureReason = ex.Message;
                    _logger.LogError(ex, "[OpenRouterGateway] Exceção durante chamada ao modelo secundário ({Fallback}) para SKU: {Sku}", fallbackModel, request.Sku);
                }
            }

            if (failureReason != null)
            {
                stopwatch.Stop();
                _logger.LogWarning("[OpenRouterGateway] {Error} para SKU: {Sku}", failureReason, request.Sku);
                return BuildFallbackResponse(request, failureReason, modelToUse, stopwatch.ElapsedMilliseconds);
            }

            var assistantContent = completionResponse!.Choices![0].Message!.Content;
            var parsedContent = _contentParser.ParseContent(assistantContent);
            if (parsedContent == null)
            {
                stopwatch.Stop();
                _logger.LogWarning("[OpenRouterGateway] Falha no parsing do JSON gerado para SKU: {Sku}", request.Sku);
                return BuildFallbackResponse(request, "Falha ao converter saída JSON do modelo.", modelToUse, stopwatch.ElapsedMilliseconds);
            }

            var promptTokens = completionResponse.Usage?.PromptTokens ?? 0;
            var completionTokens = completionResponse.Usage?.CompletionTokens ?? 0;
            var totalCost = LlmPricingCalculator.CalculateCost(modelToUse, promptTokens, completionTokens);

            stopwatch.Stop();
            var elapsedMs = stopwatch.ElapsedMilliseconds;

            _logger.LogInformation(
                "[OpenRouterGateway] SKU {Sku} enriquecido com sucesso em {ElapsedMs}ms | Modelo: {Model} | Tokens: {Prompt}+{Completion} | Custo: ${Cost:F6}",
                request.Sku,
                elapsedMs,
                modelToUse,
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
                ExecutionTimeMs = elapsedMs,
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

            return BuildFallbackResponse(request, ex.Message, modelToUse, stopwatch.ElapsedMilliseconds);
        }
    }

    private static ProductEnrichmentLlmResponse BuildFallbackResponse(
        ProductEnrichmentLlmRequest request,
        string errorMessage,
        string modelUsed,
        long? executionTimeMs = null)
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
            ExecutionTimeMs = executionTimeMs,
            IsFallback = true,
            ErrorMessage = errorMessage
        };
    }
}
