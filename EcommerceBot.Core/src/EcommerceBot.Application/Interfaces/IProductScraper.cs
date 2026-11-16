namespace EcommerceBot.Application.Interfaces;

using EcommerceBot.Application.DTOs.Messaging;

/// <summary>
/// Contrato para extração/scraping de dados de produtos a partir de páginas web externas,
/// com proteção contra SSRF e extração híbrida de JSON-LD, OpenGraph e DOM HTML.
/// </summary>
public interface IProductScraper
{
    /// <summary>
    /// Executa o scraping seguro de uma URL externa e extrai os dados estruturados do produto.
    /// </summary>
    /// <param name="request">Mensagem contendo os metadados de scraping (TenantId, SKU, Url, IsByok).</param>
    /// <param name="ct">Token de cancelamento.</param>
    /// <returns>Evento estruturado contendo o produto extraído ou status de falha.</returns>
    Task<ScrapedRawProductEvent> ScrapeAsync(ScrapingRequestMessage request, CancellationToken ct);
}
