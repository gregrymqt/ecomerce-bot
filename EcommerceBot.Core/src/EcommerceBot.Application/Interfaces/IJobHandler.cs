namespace EcommerceBot.Application.Interfaces;

using EcommerceBot.Domain.Entities;

/// <summary>
/// Contrato para processamento assíncrono de jobs de segundo plano de um determinado tipo.
/// </summary>
public interface IJobHandler
{
    /// <summary>
    /// Identificador do tipo de job processado por este handler (ex.: "scraping", "seo_enrichment").
    /// Deve coincidir com a coluna 'type' da tabela public.jobs.
    /// </summary>
    string JobType { get; }

    /// <summary>
    /// Executa o processamento do job.
    /// </summary>
    /// <param name="job">Entidade do job reivindicado.</param>
    /// <param name="ct">Token de cancelamento.</param>
    Task HandleAsync(Job job, CancellationToken ct);
}
