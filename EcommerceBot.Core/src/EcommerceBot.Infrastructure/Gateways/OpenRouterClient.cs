using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.OpenRouter;
using EcommerceBot.Application.Interfaces.Gateways;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Gateways;

/// <summary>
/// Cliente HTTP de baixo nível para comunicação com a API do OpenRouter.
/// Isola a transmissão de rede, serialização JSON, cabeçalhos de autenticação e tratamento de status HTTP.
/// </summary>
public sealed class OpenRouterClient : IOpenRouterClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<OpenRouterClient> _logger;

    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public OpenRouterClient(HttpClient httpClient, ILogger<OpenRouterClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<OpenRouterChatCompletionResponse?> CreateChatCompletionAsync(
        OpenRouterChatCompletionRequest request,
        string apiKey,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("OpenRouter API key cannot be null or empty.");
        }

        var requestJson = JsonSerializer.Serialize(request, SerializerOptions);
        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "chat/completions")
        {
            Content = new StringContent(requestJson, Encoding.UTF8, "application/json")
        };

        httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        httpRequest.Headers.TryAddWithoutValidation("HTTP-Referer", "https://ecommercebot.com");
        httpRequest.Headers.TryAddWithoutValidation("X-Title", "EcommerceBot");

        _logger.LogInformation(
            "[OpenRouterClient] Despachando chat completion para modelo: {Model}",
            request.Model);

        using var response = await _httpClient.SendAsync(httpRequest, cancellationToken);
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning(
                "[OpenRouterClient] API retornou HTTP {StatusCode}. Detalhes: {Response}",
                (int)response.StatusCode,
                responseBody);

            try
            {
                var errorResponse = JsonSerializer.Deserialize<OpenRouterChatCompletionResponse>(responseBody, SerializerOptions);
                if (errorResponse != null)
                {
                    return errorResponse;
                }
            }
            catch (JsonException)
            {
                // Ignora falha de deserialização do corpo de erro bruto
            }

            return new OpenRouterChatCompletionResponse
            {
                Error = new OpenRouterError
                {
                    Code = (int)response.StatusCode,
                    Message = $"HTTP {(int)response.StatusCode}: {responseBody}"
                }
            };
        }

        return JsonSerializer.Deserialize<OpenRouterChatCompletionResponse>(responseBody, SerializerOptions);
    }
}
