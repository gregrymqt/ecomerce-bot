using System;
using System.Text;
using EcommerceBot.Infrastructure.Scraping;
using Xunit;

namespace EcommerceBot.Core.Tests.Logic;

public sealed class ProductPayloadExtractorTests
{
    [Theory]
    [InlineData("1299.99", 1299.99)]
    [InlineData("1.299,99", 1299.99)]
    [InlineData("R$ 1.299,99", 1299.99)]
    [InlineData("R$ 49,90", 49.90)]
    [InlineData("1,299.99", 1299.99)]
    [InlineData("199,50", 199.50)]
    [InlineData("0,00", 0.0)]
    [InlineData("1500", 1500.0)]
    public void TryParseBrPrice_WithChars_ShouldParseCorrectly(string input, decimal expected)
    {
        bool success = ProductPayloadExtractor.TryParseBrPrice(input.AsSpan(), out decimal price);

        Assert.True(success);
        Assert.Equal(expected, price);
    }

    [Theory]
    [InlineData("1299.99", 1299.99)]
    [InlineData("R$ 1.299,99", 1299.99)]
    [InlineData("R$ 89,90", 89.90)]
    public void TryParseBrPrice_WithUtf8Bytes_ShouldParseCorrectly(string input, decimal expected)
    {
        byte[] bytes = Encoding.UTF8.GetBytes(input);
        bool success = ProductPayloadExtractor.TryParseBrPrice(bytes.AsSpan(), out decimal price);

        Assert.True(success);
        Assert.Equal(expected, price);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("abc")]
    [InlineData("R$ N/A")]
    [InlineData("$$")]
    public void TryParseBrPrice_WithInvalidInput_ShouldReturnFalse(string input)
    {
        bool success = ProductPayloadExtractor.TryParseBrPrice(input.AsSpan(), out decimal price);

        Assert.False(success);
        Assert.Equal(0m, price);
    }

    [Fact]
    public void TryReadJsonLdPrice_WithValidJsonLd_ShouldExtractPriceAndCurrency()
    {
        const string html = """
            <!DOCTYPE html>
            <html>
            <head>
                <script type="application/ld+json">
                {
                    "@context": "https://schema.org",
                    "@type": "Product",
                    "name": "Headset Gamer Pro",
                    "offers": {
                        "@type": "Offer",
                        "price": "349,90",
                        "priceCurrency": "BRL"
                    }
                }
                </script>
            </head>
            <body></body>
            </html>
            """;

        byte[] bytes = Encoding.UTF8.GetBytes(html);
        bool success = ProductPayloadExtractor.TryReadJsonLdPrice(bytes.AsSpan(), out decimal price, out string currency);

        Assert.True(success);
        Assert.Equal(349.90m, price);
        Assert.Equal("BRL", currency);
    }

    [Fact]
    public void TryExtractFromJsonLd_WithValidProduct_ShouldExtractFullProductDirectlyFromSpan()
    {
        const string html = """
            <!DOCTYPE html>
            <html>
            <head>
                <script type="application/ld+json">
                {
                    "@context": "https://schema.org",
                    "@type": "Product",
                    "name": "Teclado Mecânico RGB",
                    "description": "Teclado mecânico switch azul com retroiluminação RGB.",
                    "sku": "KB-RGB-01",
                    "brand": {
                        "@type": "Brand",
                        "name": "KeyTech"
                    },
                    "image": [
                        "https://cdn.example.com/keyboard-1.jpg",
                        "https://cdn.example.com/keyboard-2.jpg"
                    ],
                    "offers": {
                        "@type": "Offer",
                        "price": 279.50,
                        "priceCurrency": "BRL"
                    }
                }
                </script>
            </head>
            <body></body>
            </html>
            """;

        byte[] bytes = Encoding.UTF8.GetBytes(html);
        bool success = ProductPayloadExtractor.TryExtractFromJsonLd(bytes.AsSpan(), out var product);

        Assert.True(success);
        Assert.Equal("Teclado Mecânico RGB", product.Title);
        Assert.Equal("Teclado mecânico switch azul com retroiluminação RGB.", product.Description);
        Assert.Equal(279.50m, product.Price);
        Assert.Equal("BRL", product.Currency);
        Assert.Equal("KB-RGB-01", product.MetaAttributes["sku"]);
        Assert.Equal("KeyTech", product.MetaAttributes["brand"]);
        Assert.Equal(2, product.Images.Count);
        Assert.Equal("https://cdn.example.com/keyboard-1.jpg", product.Images[0]);
    }

    [Fact]
    public void TryExtractFromJsonLd_InsideGraph_ShouldExtractProduct()
    {
        const string html = """
            <!DOCTYPE html>
            <html>
            <head>
                <script type="application/ld+json">
                {
                    "@context": "https://schema.org",
                    "@graph": [
                        {
                            "@type": "BreadcrumbList",
                            "name": "Breadcrumbs"
                        },
                        {
                            "@type": "Product",
                            "name": "Monitor Gamer 27 165Hz",
                            "description": "Monitor IPS 1ms 165Hz FreeSync",
                            "offers": {
                                "@type": "Offer",
                                "price": "1.299,00",
                                "priceCurrency": "BRL"
                            }
                        }
                    ]
                }
                </script>
            </head>
            <body></body>
            </html>
            """;

        byte[] bytes = Encoding.UTF8.GetBytes(html);
        bool success = ProductPayloadExtractor.TryExtractFromJsonLd(bytes.AsSpan(), out var product);

        Assert.True(success);
        Assert.Equal("Monitor Gamer 27 165Hz", product.Title);
        Assert.Equal(1299.00m, product.Price);
        Assert.Equal("BRL", product.Currency);
    }

    [Fact]
    public void TryExtractFromJsonLd_WhenNoJsonLdPresent_ShouldReturnFalse()
    {
        const string html = """
            <!DOCTYPE html>
            <html>
            <head>
                <title>Loja Exemplo</title>
                <meta property="og:title" content="Mouse Sem Fio" />
            </head>
            <body></body>
            </html>
            """;

        byte[] bytes = Encoding.UTF8.GetBytes(html);
        bool success = ProductPayloadExtractor.TryExtractFromJsonLd(bytes.AsSpan(), out var product);

        Assert.False(success);
        Assert.Empty(product.Title);
    }
}
