using System;
using System.Buffers;
using System.Globalization;
using System.Text;
using System.Text.Json;

namespace EcommerceBot.Infrastructure.Scraping;

/// <summary>
/// Extrator de alta performance para extração em buffer UTF-8 (ReadOnlySpan&lt;byte&gt;) e JsonReader,
/// minimizando alocações de memória no heap e eliminando conversões intermediárias UTF-16.
/// </summary>
public static class ProductPayloadExtractor
{
    private static readonly SearchValues<byte> ScriptOpenDelimiter = SearchValues.Create("<"u8);
    private static readonly SearchValues<byte> WhitespaceBytes = SearchValues.Create(" \t\r\n"u8);

    /// <summary>
    /// Extrai produto estruturado diretamente do buffer UTF-8 procurando blocos application/ld+json.
    /// Retorna true se um produto com título válido for encontrado.
    /// </summary>
    public static bool TryExtractFromJsonLd(ReadOnlySpan<byte> utf8Html, out ProductHtmlParser.ParsedProduct product)
    {
        product = new ProductHtmlParser.ParsedProduct();
        if (utf8Html.IsEmpty) return false;

        ReadOnlySpan<byte> current = utf8Html;
        bool foundProduct = false;

        while (!current.IsEmpty)
        {
            int ldJsonIdx = current.IndexOf("application/ld+json"u8);
            if (ldJsonIdx < 0) break;

            int contentStart = FindScriptTagClose(current, ldJsonIdx);
            if (contentStart < 0 || contentStart >= current.Length) break;

            var scriptContent = current.Slice(contentStart);
            int scriptEnd = FindScriptEnd(scriptContent);
            if (scriptEnd < 0) break;

            var jsonSpan = TrimWhitespace(scriptContent.Slice(0, scriptEnd));
            if (!jsonSpan.IsEmpty)
            {
                try
                {
                    using var doc = JsonDocument.Parse(jsonSpan.ToArray());
                    if (ProductHtmlParser.FindAndPopulateProduct(doc.RootElement, product))
                    {
                        if (!string.IsNullOrWhiteSpace(product.Title))
                        {
                            foundProduct = true;
                            if (product.Price.HasValue)
                            {
                                FinalizeProduct(product);
                                return true;
                            }
                        }
                    }
                }
                catch (JsonException)
                {
                    // Ignora blocos JSON-LD inválidos
                }
            }

            int advance = contentStart + scriptEnd + 8;
            if (advance >= current.Length) break;
            current = current.Slice(advance);
        }

        if (foundProduct && !string.IsNullOrWhiteSpace(product.Title))
        {
            if (!product.Price.HasValue && TryReadJsonLdPrice(utf8Html, out var fallbackPrice, out var fallbackCurrency))
            {
                product.Price = fallbackPrice;
                if (string.IsNullOrWhiteSpace(product.Currency) || product.Currency == "BRL")
                {
                    product.Currency = fallbackCurrency;
                }
            }
            FinalizeProduct(product);
            return true;
        }

        return false;
    }

    /// <summary>
    /// Lê rapidamente preço e moeda diretamente da stream JSON-LD usando Utf8JsonReader sem instanciar JsonDocument completo.
    /// </summary>
    public static bool TryReadJsonLdPrice(ReadOnlySpan<byte> utf8Html, out decimal price, out string currency)
    {
        price = 0m;
        currency = "BRL";
        if (utf8Html.IsEmpty) return false;

        ReadOnlySpan<byte> current = utf8Html;
        while (!current.IsEmpty)
        {
            int ldJsonIdx = current.IndexOf("application/ld+json"u8);
            if (ldJsonIdx < 0) break;

            int contentStart = FindScriptTagClose(current, ldJsonIdx);
            if (contentStart < 0 || contentStart >= current.Length) break;

            var scriptContent = current.Slice(contentStart);
            int scriptEnd = FindScriptEnd(scriptContent);
            if (scriptEnd < 0) break;

            var jsonSpan = TrimWhitespace(scriptContent.Slice(0, scriptEnd));
            if (!jsonSpan.IsEmpty)
            {
                try
                {
                    var reader = new Utf8JsonReader(jsonSpan);
                    while (reader.Read())
                    {
                        if (reader.TokenType == JsonTokenType.PropertyName)
                        {
                            if (reader.ValueTextEquals("priceCurrency"u8))
                            {
                                if (reader.Read() && reader.TokenType == JsonTokenType.String)
                                {
                                    var cur = reader.GetString();
                                    if (!string.IsNullOrWhiteSpace(cur))
                                        currency = cur;
                                }
                            }
                            else if (reader.ValueTextEquals("price"u8))
                            {
                                if (reader.Read())
                                {
                                    if (reader.TokenType == JsonTokenType.Number && reader.TryGetDecimal(out var decPrice))
                                    {
                                        price = decPrice;
                                        return true;
                                    }
                                    if (reader.TokenType == JsonTokenType.String)
                                    {
                                        if (TryParseBrPrice(reader.ValueSpan, out var strPrice))
                                        {
                                            price = strPrice;
                                            return true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                catch (JsonException)
                {
                    // Ignora JSONs malformados
                }
            }

            int advance = contentStart + scriptEnd + 8;
            if (advance >= current.Length) break;
            current = current.Slice(advance);
        }

        return false;
    }

    /// <summary>
    /// Converte representações de preço em formatos monetários comuns (BRL, USD, raw) com zero heap allocations via stackalloc.
    /// </summary>
    public static bool TryParseBrPrice(ReadOnlySpan<byte> utf8Price, out decimal price)
    {
        price = 0m;
        if (utf8Price.IsEmpty) return false;

        Span<char> chars = stackalloc char[Math.Min(utf8Price.Length, 64)];
        int charCount = Encoding.UTF8.GetChars(utf8Price.Slice(0, Math.Min(utf8Price.Length, 64)), chars);
        return TryParseBrPrice(chars[..charCount], out price);
    }

    /// <summary>
    /// Converte caracteres de preço normalizando pontuações pt-BR / en-US usando stackalloc.
    /// </summary>
    public static bool TryParseBrPrice(ReadOnlySpan<char> priceChars, out decimal price)
    {
        price = 0m;
        if (priceChars.IsEmpty) return false;

        Span<char> clean = stackalloc char[64];
        int cleanLen = 0;

        int lastDot = -1;
        int lastComma = -1;

        for (int i = 0; i < priceChars.Length && cleanLen < 64; i++)
        {
            char c = priceChars[i];
            if (char.IsDigit(c))
            {
                clean[cleanLen++] = c;
            }
            else if (c == '.')
            {
                lastDot = cleanLen;
                clean[cleanLen++] = '.';
            }
            else if (c == ',')
            {
                lastComma = cleanLen;
                clean[cleanLen++] = ',';
            }
            else if (c == '-' && cleanLen == 0)
            {
                clean[cleanLen++] = '-';
            }
        }

        if (cleanLen == 0) return false;

        Span<char> normalized = stackalloc char[cleanLen];
        int normLen = 0;

        if (lastDot >= 0 && lastComma >= 0)
        {
            if (lastComma > lastDot)
            {
                for (int i = 0; i < cleanLen; i++)
                {
                    if (clean[i] == '.') continue;
                    if (clean[i] == ',') normalized[normLen++] = '.';
                    else normalized[normLen++] = clean[i];
                }
            }
            else
            {
                for (int i = 0; i < cleanLen; i++)
                {
                    if (clean[i] == ',') continue;
                    normalized[normLen++] = clean[i];
                }
            }
        }
        else if (lastComma >= 0)
        {
            for (int i = 0; i < cleanLen; i++)
            {
                if (clean[i] == ',') normalized[normLen++] = '.';
                else normalized[normLen++] = clean[i];
            }
        }
        else
        {
            clean[..cleanLen].CopyTo(normalized);
            normLen = cleanLen;
        }

        return decimal.TryParse(normalized[..normLen], NumberStyles.Any, CultureInfo.InvariantCulture, out price);
    }

    private static ReadOnlySpan<byte> TrimWhitespace(ReadOnlySpan<byte> span)
    {
        int start = 0;
        while (start < span.Length && WhitespaceBytes.Contains(span[start]))
        {
            start++;
        }

        int end = span.Length - 1;
        while (end >= start && WhitespaceBytes.Contains(span[end]))
        {
            end--;
        }

        return start <= end ? span.Slice(start, end - start + 1) : ReadOnlySpan<byte>.Empty;
    }

    private static int FindScriptTagClose(ReadOnlySpan<byte> span, int ldJsonOffset)
    {
        var after = span.Slice(ldJsonOffset);
        int closeIdx = after.IndexOf((byte)'>');
        if (closeIdx >= 0)
        {
            return ldJsonOffset + closeIdx + 1;
        }
        return -1;
    }

    private static int FindScriptEnd(ReadOnlySpan<byte> span)
    {
        var current = span;
        int offset = 0;
        while (!current.IsEmpty)
        {
            int idx = current.IndexOfAny(ScriptOpenDelimiter);
            if (idx < 0) return -1;

            var remainder = current.Slice(idx);
            if (StartsWithScriptCloseTag(remainder))
            {
                int closeTagEnd = remainder.IndexOf((byte)'>');
                if (closeTagEnd >= 0)
                {
                    return offset + idx;
                }
            }

            offset += idx + 1;
            current = current.Slice(idx + 1);
        }

        return -1;
    }

    private static bool StartsWithScriptCloseTag(ReadOnlySpan<byte> remainder)
    {
        ReadOnlySpan<byte> prefix = "</script"u8;
        if (remainder.Length < prefix.Length) return false;

        for (int i = 0; i < prefix.Length; i++)
        {
            byte b = remainder[i];
            byte target = prefix[i];
            if (b != target && (b | 0x20) != target)
                return false;
        }
        return true;
    }

    private static void FinalizeProduct(ProductHtmlParser.ParsedProduct product)
    {
        if (!string.IsNullOrWhiteSpace(product.Description) && string.IsNullOrWhiteSpace(product.RawDescriptionHtml))
        {
            product.RawDescriptionHtml = $"<p>{product.Description}</p>";
        }
        product.RawMarkdown = !string.IsNullOrWhiteSpace(product.Description)
            ? product.Description
            : product.Title;
    }
}
