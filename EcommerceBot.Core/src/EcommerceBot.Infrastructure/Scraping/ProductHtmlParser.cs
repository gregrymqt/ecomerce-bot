namespace EcommerceBot.Infrastructure.Scraping;

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;

/// <summary>
/// Parser nativo de alta performance para extração de metadados de e-commerce a partir de HTML,
/// combinando JSON-LD estruturado (schema.org/Product), OpenGraph, Meta Tags e heurísticas de DOM.
/// </summary>
public static partial class ProductHtmlParser
{
    private static readonly Regex JsonLdRegex = new(
        @"<script[^>]*type=[""']application\/ld\+json[""'][^>]*>(.*?)<\/script>",
        RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);

    private static readonly Regex MetaTagRegex = new(
        @"<meta\s+([^>]+)>",
        RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);

    private static readonly Regex AttributeRegex = new(
        @"(?<key>[a-zA-Z0-9_\-:]+)=[""'](?<val>[^""']*)[""']",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex TitleTagRegex = new(
        @"<title[^>]*>(.*?)<\/title>",
        RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);

    private static readonly Regex H1TagRegex = new(
        @"<h1[^>]*>(.*?)<\/h1>",
        RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);

    private static readonly Regex ImgTagRegex = new(
        @"<img\s+[^>]*src=[""'](?<src>https?:\/\/[^""'>]+)[""'][^>]*>",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex DescriptionElementRegex = new(
        @"<(div|section|article)[^>]*(id=[""']description[""']|class=[""'][^""']*product-description[^""']*[""']|itemprop=[""']description[""'])[^>]*>(?<content>.*?)<\/\1>",
        RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);

    private static readonly Regex HtmlTagStripRegex = new(
        @"<[^>]+>",
        RegexOptions.Compiled);

    public sealed class ParsedProduct
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string RawDescriptionHtml { get; set; } = string.Empty;
        public string RawMarkdown { get; set; } = string.Empty;
        public decimal? Price { get; set; }
        public string Currency { get; set; } = "BRL";
        public List<string> Images { get; } = new();
        public Dictionary<string, string> MetaAttributes { get; } = new(StringComparer.OrdinalIgnoreCase);
    }

    public static ParsedProduct Parse(string html)
    {
        var product = new ParsedProduct();
        if (string.IsNullOrWhiteSpace(html))
            return product;

        // 1. Extração prioritária via JSON-LD (Schema.org/Product)
        ExtractFromJsonLd(html, product);

        // 2. Extração complementar via Meta Tags / OpenGraph
        ExtractFromMetaTags(html, product);

        // 3. Fallbacks de Título no DOM
        if (string.IsNullOrWhiteSpace(product.Title))
        {
            var titleMatch = TitleTagRegex.Match(html);
            if (titleMatch.Success)
            {
                product.Title = CleanHtmlText(titleMatch.Groups[1].Value);
            }
            else
            {
                var h1Match = H1TagRegex.Match(html);
                if (h1Match.Success)
                {
                    product.Title = CleanHtmlText(h1Match.Groups[1].Value);
                }
            }
        }

        // 4. Imagens adicionais no DOM (até 5 imagens)
        if (product.Images.Count < 3)
        {
            var imgMatches = ImgTagRegex.Matches(html);
            foreach (Match match in imgMatches)
            {
                if (product.Images.Count >= 5)
                    break;

                var src = match.Groups["src"].Value.Trim();
                if (IsValidProductImage(src) && !product.Images.Contains(src))
                {
                    product.Images.Add(src);
                }
            }
        }

        // 5. Descrição HTML e Markdown
        if (string.IsNullOrWhiteSpace(product.RawDescriptionHtml))
        {
            var descMatch = DescriptionElementRegex.Match(html);
            if (descMatch.Success)
            {
                product.RawDescriptionHtml = descMatch.Groups["content"].Value.Trim();
                if (string.IsNullOrWhiteSpace(product.Description))
                {
                    product.Description = CleanHtmlText(product.RawDescriptionHtml);
                }
            }
            else if (!string.IsNullOrWhiteSpace(product.Description))
            {
                product.RawDescriptionHtml = $"<p>{product.Description}</p>";
            }
        }

        product.RawMarkdown = !string.IsNullOrWhiteSpace(product.Description)
            ? product.Description
            : product.Title;

        return product;
    }

    private static void ExtractFromJsonLd(string html, ParsedProduct product)
    {
        var matches = JsonLdRegex.Matches(html);
        foreach (Match match in matches)
        {
            var rawJson = match.Groups[1].Value.Trim();
            if (string.IsNullOrWhiteSpace(rawJson))
                continue;

            try
            {
                using var doc = JsonDocument.Parse(rawJson);
                if (FindAndPopulateProduct(doc.RootElement, product))
                {
                    if (!string.IsNullOrWhiteSpace(product.Title))
                        return; // Produto principal encontrado
                }
            }
            catch (JsonException)
            {
                // Ignora scripts JSON-LD malformados
            }
        }
    }

    internal static bool FindAndPopulateProduct(JsonElement element, ParsedProduct product)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                if (element.TryGetProperty("@type", out var typeProp))
                {
                    var isProduct = false;
                    if (typeProp.ValueKind == JsonValueKind.String &&
                        string.Equals(typeProp.GetString(), "Product", StringComparison.OrdinalIgnoreCase))
                    {
                        isProduct = true;
                    }
                    else if (typeProp.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var item in typeProp.EnumerateArray())
                        {
                            if (item.ValueKind == JsonValueKind.String &&
                                string.Equals(item.GetString(), "Product", StringComparison.OrdinalIgnoreCase))
                            {
                                isProduct = true;
                                break;
                            }
                        }
                    }

                    if (isProduct)
                    {
                        PopulateFromProductJson(element, product);
                        return true;
                    }
                }

                // Verifica @graph
                if (element.TryGetProperty("@graph", out var graphProp) && graphProp.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in graphProp.EnumerateArray())
                    {
                        if (FindAndPopulateProduct(item, product))
                            return true;
                    }
                }
                break;

            case JsonValueKind.Array:
                foreach (var item in element.EnumerateArray())
                {
                    if (FindAndPopulateProduct(item, product))
                        return true;
                }
                break;
        }

        return false;
    }

    private static void PopulateFromProductJson(JsonElement element, ParsedProduct product)
    {
        if (element.TryGetProperty("name", out var nameProp) && nameProp.ValueKind == JsonValueKind.String)
        {
            product.Title = nameProp.GetString()?.Trim() ?? string.Empty;
        }

        if (element.TryGetProperty("description", out var descProp) && descProp.ValueKind == JsonValueKind.String)
        {
            product.Description = descProp.GetString()?.Trim() ?? string.Empty;
        }

        if (element.TryGetProperty("sku", out var skuProp) && skuProp.ValueKind == JsonValueKind.String)
        {
            product.MetaAttributes["sku"] = skuProp.GetString()?.Trim() ?? string.Empty;
        }

        if (element.TryGetProperty("brand", out var brandProp))
        {
            if (brandProp.ValueKind == JsonValueKind.String)
            {
                product.MetaAttributes["brand"] = brandProp.GetString()?.Trim() ?? string.Empty;
            }
            else if (brandProp.ValueKind == JsonValueKind.Object &&
                     brandProp.TryGetProperty("name", out var brandName) &&
                     brandName.ValueKind == JsonValueKind.String)
            {
                product.MetaAttributes["brand"] = brandName.GetString()?.Trim() ?? string.Empty;
            }
        }

        if (element.TryGetProperty("image", out var imgProp))
        {
            ExtractImagesFromJson(imgProp, product.Images);
        }

        if (element.TryGetProperty("offers", out var offersProp))
        {
            ExtractOffersFromJson(offersProp, product);
        }
    }

    private static void ExtractImagesFromJson(JsonElement element, List<string> images)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.String:
                var url = element.GetString()?.Trim();
                if (!string.IsNullOrWhiteSpace(url) && !images.Contains(url))
                    images.Add(url);
                break;

            case JsonValueKind.Array:
                foreach (var item in element.EnumerateArray())
                {
                    ExtractImagesFromJson(item, images);
                }
                break;

            case JsonValueKind.Object:
                if (element.TryGetProperty("url", out var urlProp) && urlProp.ValueKind == JsonValueKind.String)
                {
                    var u = urlProp.GetString()?.Trim();
                    if (!string.IsNullOrWhiteSpace(u) && !images.Contains(u))
                        images.Add(u);
                }
                break;
        }
    }

    private static void ExtractOffersFromJson(JsonElement element, ParsedProduct product)
    {
        JsonElement targetOffer = default;

        if (element.ValueKind == JsonValueKind.Object)
        {
            targetOffer = element;
        }
        else if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in element.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.Object)
                {
                    targetOffer = item;
                    break;
                }
            }
        }

        if (targetOffer.ValueKind == JsonValueKind.Object)
        {
            if (targetOffer.TryGetProperty("priceCurrency", out var currProp) && currProp.ValueKind == JsonValueKind.String)
            {
                var curr = currProp.GetString()?.Trim();
                if (!string.IsNullOrWhiteSpace(curr))
                    product.Currency = curr;
            }

            if (targetOffer.TryGetProperty("price", out var priceProp))
            {
                if (priceProp.ValueKind == JsonValueKind.Number && priceProp.TryGetDecimal(out var decVal))
                {
                    product.Price = decVal;
                }
                else if (priceProp.ValueKind == JsonValueKind.String)
                {
                    var priceStr = priceProp.GetString();
                    if (!string.IsNullOrWhiteSpace(priceStr) &&
                        ProductPayloadExtractor.TryParseBrPrice(priceStr.AsSpan(), out var parsed))
                    {
                        product.Price = parsed;
                    }
                }
            }
        }
    }

    private static void ExtractFromMetaTags(string html, ParsedProduct product)
    {
        var metaMatches = MetaTagRegex.Matches(html);
        foreach (Match match in metaMatches)
        {
            var attributesText = match.Groups[1].Value;
            var attrMatches = AttributeRegex.Matches(attributesText);

            string? key = null;
            string? content = null;

            foreach (Match attr in attrMatches)
            {
                var attrName = attr.Groups["key"].Value.ToLowerInvariant();
                var attrVal = attr.Groups["val"].Value;

                if (attrName is "property" or "name")
                    key = attrVal.ToLowerInvariant();
                else if (attrName == "content")
                    content = attrVal;
            }

            if (string.IsNullOrWhiteSpace(key) || string.IsNullOrWhiteSpace(content))
                continue;

            content = WebUtility.HtmlDecode(content.Trim());

            switch (key)
            {
                case "og:title" or "twitter:title" when string.IsNullOrWhiteSpace(product.Title):
                    product.Title = content;
                    break;

                case "og:description" or "description" or "twitter:description" when string.IsNullOrWhiteSpace(product.Description):
                    product.Description = content;
                    break;

                case "og:image" or "twitter:image" when product.Images.Count == 0:
                    product.Images.Add(content);
                    break;

                case "product:price:amount" when product.Price == null:
                    var cleanPrice = content.Replace(",", ".").Replace(" ", "").Trim();
                    if (decimal.TryParse(cleanPrice, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsedPrice))
                    {
                        product.Price = parsedPrice;
                    }
                    break;

                case "product:price:currency":
                    product.Currency = content;
                    break;
            }
        }
    }

    private static bool IsValidProductImage(string src)
    {
        var lower = src.ToLowerInvariant();
        return !lower.Contains("logo") &&
               !lower.Contains("icon") &&
               !lower.Contains("avatar") &&
               !lower.Contains("badge") &&
               !lower.Contains("pixel") &&
               !lower.Contains("spinner") &&
               !lower.EndsWith(".svg", StringComparison.OrdinalIgnoreCase);
    }

    private static string CleanHtmlText(string raw)
    {
        var decoded = WebUtility.HtmlDecode(raw);
        var stripped = HtmlTagStripRegex.Replace(decoded, " ");
        return Regex.Replace(stripped, @"\s+", " ").Trim();
    }
}
