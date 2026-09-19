using EcommerceBot.Application.DTOs.Ai;
using EcommerceBot.Application.DTOs.OpenRouter;

namespace EcommerceBot.Application.Interfaces.Services;

/// <summary>
/// Serviço responsável pela engenharia de prompts de copywriting persuasivo (CRO/SEO)
/// e aplicação de protocolos de segurança para mitigação de Prompt Injection sobre dados raspados.
/// </summary>
public interface IProductEnrichmentPromptService
{
    /// <summary>
    /// Constrói a requisição estruturada para o OpenRouter com persona de copywriter e isolamento anti-injection.
    /// </summary>
    OpenRouterChatCompletionRequest BuildPromptRequest(ProductEnrichmentLlmRequest request, string model);
}
