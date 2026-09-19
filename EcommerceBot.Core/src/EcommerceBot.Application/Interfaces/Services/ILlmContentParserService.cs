using EcommerceBot.Application.DTOs.Ai;

namespace EcommerceBot.Application.Interfaces.Services;

/// <summary>
/// Serviço responsável pela extração resiliente de blocos JSON a partir de saídas brutas de LLMs
/// e conversão fortemente tipada para estruturas de enriquecimento de produto.
/// </summary>
public interface ILlmContentParserService
{
    /// <summary>
    /// Extrai o JSON removendo marcadores markdown e deserializa para ProductEnrichmentAiContent.
    /// </summary>
    ProductEnrichmentAiContent? ParseContent(string? rawContent);
}
