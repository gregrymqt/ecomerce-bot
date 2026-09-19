using System;

namespace EcommerceBot.Domain.Services;

/// <summary>
/// Domain Service responsável pelo cálculo de precificação e custos de inferência de LLMs
/// com base no modelo selecionado e na contagem de tokens de prompt e completion.
/// </summary>
public static class LlmPricingCalculator
{
    // Tarifas de referência por 1 milhão de tokens (ex: DeepSeek-V3 no OpenRouter: $0.14 prompt, $0.28 completion)
    private const decimal DeepSeekPromptCostPerToken = 0.00000014m;
    private const decimal DeepSeekCompletionCostPerToken = 0.00000028m;

    // Tarifas de referência para modelos alternativos (OpenAI GPT-4o-mini: $0.15 prompt, $0.60 completion)
    private const decimal Gpt4MiniPromptCostPerToken = 0.00000015m;
    private const decimal Gpt4MiniCompletionCostPerToken = 0.00000060m;

    /// <summary>
    /// Calcula o custo estimado em dólares (USD) para a chamada de inferência.
    /// </summary>
    public static decimal CalculateCost(string model, int promptTokens, int completionTokens)
    {
        if (promptTokens <= 0 && completionTokens <= 0)
        {
            return 0m;
        }

        var normalizedModel = model?.Trim().ToLowerInvariant() ?? string.Empty;

        var (promptRate, completionRate) = normalizedModel switch
        {
            var m when m.Contains("mini") => (Gpt4MiniPromptCostPerToken, Gpt4MiniCompletionCostPerToken),
            _ => (DeepSeekPromptCostPerToken, DeepSeekCompletionCostPerToken)
        };

        var promptCost = promptTokens * promptRate;
        var completionCost = completionTokens * completionRate;

        return Math.Round(promptCost + completionCost, 6);
    }
}
