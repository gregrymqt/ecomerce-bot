using System;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

/// <summary>
/// Contrato de persistência para recuperação de diretrizes relacionais de SEO por categoria.
/// </summary>
public interface ICategorySeoGuidelinesRepository
{
    /// <summary>
    /// Recupera a diretriz de SEO mais específica para a categoria informada, priorizando o tenant especificado
    /// e recorrendo às diretrizes globais da plataforma (TenantId IS NULL) caso necessário.
    /// </summary>
    Task<CategorySeoGuideline?> GetGuidelineByCategoryAsync(
        Guid tenantId,
        string? categoryName,
        CancellationToken cancellationToken = default);
}
