using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Ai;

namespace EcommerceBot.Application.Interfaces.Gateways;

/// <summary>
/// Gateway resiliente para orquestração de inferência de LLMs (OpenRouter/DeepSeek),
/// responsável pelo copywriting persuasivo, bullet points, SEO e sanitização contra prompt injection.
/// </summary>
public interface IOpenRouterGateway
{
    /// <summary>
    /// Transforma dados brutos raspados em copywriting de alta conversão estruturado com métricas de tokens.
    /// </summary>
    Task<ProductEnrichmentLlmResponse> EnrichProductAsync(
        ProductEnrichmentLlmRequest request,
        CancellationToken cancellationToken = default);
}
