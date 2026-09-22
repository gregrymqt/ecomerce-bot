using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using FluentAssertions;

namespace EcommerceBot.Core.Tests.Evals.Heuristics;

/// <summary>
/// Validador heurístico de métricas de qualidade de SEO e copywriting de e-commerce.
/// Assegura conformidade com boas práticas de motores de busca, vitrines e legibilidade.
/// </summary>
public static class SeoQualityValidator
{
    private static readonly Regex HtmlTagsRegex = new(@"<\s*(script|style|div|p|span|a|h[1-6]|ul|ol|li|table|iframe|b|i|strong|em)\b[^>]*>", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex ClosingHtmlTagsRegex = new(@"<\s*/\s*(script|style|div|p|span|a|h[1-6]|ul|ol|li|table|iframe|b|i|strong|em)\s*>", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>
    /// Valida se o título possui entre 20 e 75 caracteres, faixa ótima para SERP e cards de produtos.
    /// </summary>
    public static void ValidateTitleLength(string? title)
    {
        title.Should().NotBeNullOrWhiteSpace("o título gerado não pode ser nulo ou vazio.");
        
        var length = title!.Trim().Length;
        length.Should().BeInRange(20, 75,
            $"o título '{title}' possui {length} caracteres, devendo estar entre 20 e 75 caracteres para SEO ideal.");
    }

    /// <summary>
    /// Valida se a quantidade de bullet points de benefícios situa-se entre 3 e 6 itens substanciais.
    /// </summary>
    public static void ValidateBulletPoints(IReadOnlyList<string>? bulletPoints)
    {
        bulletPoints.Should().NotBeNull("a lista de bullet points não pode ser nula.");
        bulletPoints!.Count.Should().BeInRange(3, 6,
            "a lista de bullet points deve conter entre 3 e 6 destaques de benefícios e diferenciais.");

        foreach (var bullet in bulletPoints)
        {
            bullet.Should().NotBeNullOrWhiteSpace("nenhum bullet point pode ser vazio.");
            bullet.Trim().Length.Should().BeGreaterThanOrEqualTo(15,
                $"o bullet point '{bullet}' deve possuir densidade mínima de 15 caracteres.");
        }
    }

    /// <summary>
    /// Valida se foram geradas ao menos 2 perguntas e respostas frequentes para quebra de objeções.
    /// </summary>
    public static void ValidateFaqs(IReadOnlyList<GoldenFaqModel>? faqs)
    {
        faqs.Should().NotBeNull("a lista de FAQs não pode ser nula.");
        faqs!.Count.Should().BeGreaterThanOrEqualTo(2,
            "devem ser fornecidas ao menos 2 perguntas frequentes (FAQs) para resolução de dúvidas.");

        foreach (var faq in faqs)
        {
            faq.Question.Should().NotBeNullOrWhiteSpace("a pergunta da FAQ não pode ser vazia.");
            faq.Answer.Should().NotBeNullOrWhiteSpace("a resposta da FAQ não pode ser vazia.");
            faq.Question.Trim().Length.Should().BeGreaterThanOrEqualTo(10, "a pergunta da FAQ deve ser clara e detalhada.");
            faq.Answer.Trim().Length.Should().BeGreaterThanOrEqualTo(15, "a resposta da FAQ deve ser explicativa.");
        }
    }

    /// <summary>
    /// Valida se as palavras-chave de SEO geradas atendem aos critérios de quantidade e preenchimento.
    /// </summary>
    public static void ValidateKeywords(IReadOnlyList<string>? keywords)
    {
        keywords.Should().NotBeNull("a lista de palavras-chave não pode ser nula.");
        keywords!.Count.Should().BeInRange(3, 10, "devem ser geradas entre 3 e 10 palavras-chave relevantes.");

        foreach (var kw in keywords)
        {
            kw.Should().NotBeNullOrWhiteSpace("palavras-chave não podem ser vazias.");
        }
    }

    /// <summary>
    /// Valida se a descrição gerada está limpa de tags HTML residuais ou injeções de script.
    /// </summary>
    public static void ValidateNoResidualHtml(string? description)
    {
        description.Should().NotBeNullOrWhiteSpace("a descrição não pode ser nula ou vazia.");

        HtmlTagsRegex.IsMatch(description!).Should().BeFalse(
            "a descrição contém tags HTML de abertura residuais que poluem o display no e-commerce.");

        ClosingHtmlTagsRegex.IsMatch(description!).Should().BeFalse(
            "a descrição contém tags HTML de fechamento residuais.");
    }
}
