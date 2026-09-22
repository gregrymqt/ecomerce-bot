using System;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories;

/// <summary>
/// Repositório Dapper para consulta de diretrizes relacionais de SEO por categoria.
/// Otimizado com índice de cobertura, isolamento de tenant estrito e ordenação por especificidade.
/// </summary>
public sealed class CategorySeoGuidelinesRepository : ICategorySeoGuidelinesRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public CategorySeoGuidelinesRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<CategorySeoGuideline?> GetGuidelineByCategoryAsync(
        Guid tenantId,
        string? categoryName,
        CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);

        const string sql = """
            SELECT TOP 1 
                Id, TenantId, CategoryPattern, MandatoryKeywords, 
                RecommendedTone, FewShotExampleTitle, FewShotExampleDescription,
                IsActive, CreatedAt
            FROM dbo.CategorySeoGuidelines WITH (NOLOCK)
            WHERE IsActive = 1
              AND (TenantId = @TenantId OR TenantId IS NULL)
              AND (@Category LIKE CategoryPattern OR CategoryPattern = '%')
            ORDER BY 
                CASE WHEN TenantId = @TenantId THEN 0 ELSE 1 END,
                LEN(CategoryPattern) DESC;
        """;

        var categoryToMatch = string.IsNullOrWhiteSpace(categoryName) ? "Geral" : categoryName.Trim();

        var cmd = new CommandDefinition(
            sql,
            new { TenantId = tenantId, Category = categoryToMatch },
            cancellationToken: cancellationToken);

        return await connection.QueryFirstOrDefaultAsync<CategorySeoGuideline>(cmd);
    }
}
