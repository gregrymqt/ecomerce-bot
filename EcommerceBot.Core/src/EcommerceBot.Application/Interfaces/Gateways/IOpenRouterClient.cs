using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.OpenRouter;

namespace EcommerceBot.Application.Interfaces.Gateways;

/// <summary>
/// Contrato do cliente HTTP de baixo nível para comunicação estrita com a API do OpenRouter.
/// Isola serialização de rede, autenticação por Bearer token e cabeçalhos de integração.
/// </summary>
public interface IOpenRouterClient
{
    /// <summary>
    /// Despacha uma solicitação de chat completion para o endpoint /chat/completions da API do OpenRouter.
    /// </summary>
    Task<OpenRouterChatCompletionResponse?> CreateChatCompletionAsync(
        OpenRouterChatCompletionRequest request,
        string apiKey,
        CancellationToken cancellationToken = default);
}
