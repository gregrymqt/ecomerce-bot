using System;
using System.Text.Json;
using EcommerceBot.Application.DTOs.Ai;
using FluentAssertions;

namespace EcommerceBot.Core.Tests.Evals.Heuristics;

/// <summary>
/// Validador estrutural de saídas JSON geradas pelo modelo (Structured Outputs).
/// </summary>
public static class StructuredOutputValidator
{
    /// <summary>
    /// Valida a conformidade estrutural do modelo de dados gerado.
    /// </summary>
    public static void Validate(GoldenOutputModel? output)
    {
        output.Should().NotBeNull("a saída da IA não pode ser nula.");
        output!.Title.Should().NotBeNullOrWhiteSpace("o campo 'title' é obrigatório no schema.");
        output.Description.Should().NotBeNullOrWhiteSpace("o campo 'description' é obrigatório no schema.");
        output.BulletPoints.Should().NotBeNull().And.NotBeEmpty("o campo 'bullet_points' deve ser um array preenchido.");
        output.SeoKeywords.Should().NotBeNull().And.NotBeEmpty("o campo 'seo_keywords' deve ser um array preenchido.");
        output.Faqs.Should().NotBeNull().And.NotBeEmpty("o campo 'faqs' deve ser um array preenchido.");
    }

    /// <summary>
    /// Valida se uma string JSON bruta adere estritamente ao contrato de DTO de enriquecimento.
    /// </summary>
    public static ProductEnrichmentAiContent ValidateAndDeserialize(string json)
    {
        json.Should().NotBeNullOrWhiteSpace("a string JSON não pode ser vazia.");

        ProductEnrichmentAiContent? parsed = null;
        Action act = () =>
        {
            parsed = JsonSerializer.Deserialize<ProductEnrichmentAiContent>(
                json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        };

        act.Should().NotThrow("o JSON gerado pela LLM deve ser sintaticamente válido e mapeável para ProductEnrichmentAiContent.");
        parsed.Should().NotBeNull("o objeto deserializado não pode ser nulo.");
        parsed!.Title.Should().NotBeNullOrWhiteSpace("o título da resposta deserializada é obrigatório.");
        parsed.Description.Should().NotBeNullOrWhiteSpace("a descrição da resposta deserializada é obrigatória.");

        return parsed;
    }
}
