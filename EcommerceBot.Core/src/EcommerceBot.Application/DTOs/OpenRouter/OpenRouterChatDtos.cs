using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.OpenRouter;

/// <summary>
/// Payload de requisição enviado ao endpoint /chat/completions da API do OpenRouter.
/// </summary>
public sealed record OpenRouterChatCompletionRequest
{
    [JsonPropertyName("model")]
    public string Model { get; init; } = string.Empty;

    [JsonPropertyName("messages")]
    public List<OpenRouterMessage> Messages { get; init; } = new();

    [JsonPropertyName("response_format")]
    public OpenRouterResponseFormat? ResponseFormat { get; init; }

    [JsonPropertyName("temperature")]
    public double Temperature { get; init; } = 0.4;
}

/// <summary>
/// Mensagem de chat individual (system, user, assistant).
/// </summary>
public sealed record OpenRouterMessage
{
    [JsonPropertyName("role")]
    public string Role { get; init; } = string.Empty;

    [JsonPropertyName("content")]
    public string Content { get; init; } = string.Empty;
}

/// <summary>
/// Especificação do formato de resposta estruturada (ex: json_object).
/// </summary>
public sealed record OpenRouterResponseFormat
{
    [JsonPropertyName("type")]
    public string Type { get; init; } = "json_object";
}

/// <summary>
/// Payload de resposta retornado pela API do OpenRouter.
/// </summary>
public sealed record OpenRouterChatCompletionResponse
{
    [JsonPropertyName("id")]
    public string? Id { get; init; }

    [JsonPropertyName("model")]
    public string? Model { get; init; }

    [JsonPropertyName("choices")]
    public List<OpenRouterChoice>? Choices { get; init; }

    [JsonPropertyName("usage")]
    public OpenRouterUsage? Usage { get; init; }

    [JsonPropertyName("error")]
    public OpenRouterError? Error { get; init; }
}

/// <summary>
/// Opção gerada pelo modelo na completion.
/// </summary>
public sealed record OpenRouterChoice
{
    [JsonPropertyName("message")]
    public OpenRouterMessage? Message { get; init; }

    [JsonPropertyName("finish_reason")]
    public string? FinishReason { get; init; }
}

/// <summary>
/// Métricas de consumo de tokens retornadas pela API.
/// </summary>
public sealed record OpenRouterUsage
{
    [JsonPropertyName("prompt_tokens")]
    public int PromptTokens { get; init; }

    [JsonPropertyName("completion_tokens")]
    public int CompletionTokens { get; init; }

    [JsonPropertyName("total_tokens")]
    public int TotalTokens { get; init; }
}

/// <summary>
/// Detalhes de erro emitidos pelo OpenRouter quando uma requisição falha.
/// </summary>
public sealed record OpenRouterError
{
    [JsonPropertyName("code")]
    public object? Code { get; init; }

    [JsonPropertyName("message")]
    public string? Message { get; init; }
}
