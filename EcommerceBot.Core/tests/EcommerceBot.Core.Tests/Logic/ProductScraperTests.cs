namespace EcommerceBot.Core.Tests.Logic;

using System;
using System.Net;
using System.Net.Http;
using System.Security;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Messaging;
using EcommerceBot.Infrastructure.Scraping;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

public sealed class ProductScraperTests
{
    [Theory]
    [InlineData("http://localhost/test")]
    [InlineData("https://localhost:8080/admin")]
    [InlineData("http://127.0.0.1:5000/api")]
    [InlineData("http://127.0.0.2/")]
    [InlineData("http://10.0.0.1/private")]
    [InlineData("http://172.16.0.1/")]
    [InlineData("http://172.31.255.255/")]
    [InlineData("http://192.168.0.1/router")]
    [InlineData("http://169.254.169.254/latest/meta-data/")]
    [InlineData("http://100.64.0.1/cgnat")]
    [InlineData("http://[::1]/")]
    [InlineData("http://[fc00::1]/")]
    [InlineData("http://[fe80::1]/")]
    [InlineData("http://test.localhost/api")]
    [InlineData("http://internal.service.local/")]
    [InlineData("http://db.cluster.internal/")]
    public void AntiSsrfValidator_ShouldBlockRestrictedHostsAndIps(string dangerousUrl)
    {
        var act = () => AntiSsrfValidator.ValidateUrlSafety(dangerousUrl);
        act.Should().Throw<SecurityException>();
    }

    [Theory]
    [InlineData("ftp://example.com/file.txt")]
    [InlineData("file:///etc/passwd")]
    [InlineData("gopher://example.com/")]
    [InlineData("javascript:alert(1)")]
    public void AntiSsrfValidator_ShouldBlockNonHttpProtocols(string invalidSchemeUrl)
    {
        var act = () => AntiSsrfValidator.ValidateUrlSafety(invalidSchemeUrl);
        act.Should().Throw<Exception>();
    }

    [Theory]
    [InlineData("https://www.google.com")]
    [InlineData("https://loja.exemplo.com.br/produto/tenis-corrida")]
    [InlineData("http://93.184.216.34/")] // Example.com IP público
    public void AntiSsrfValidator_ShouldAllowValidPublicTargets(string publicUrl)
    {
        var uri = AntiSsrfValidator.ValidateUrlSafety(publicUrl);
        uri.Should().NotBeNull();
        uri.Scheme.Should().Match(s => s == "http" || s == "https");
    }

    [Fact]
    public void ProductHtmlParser_ShouldExtractFullJsonLdProduct()
    {
        const string html = """
            <!DOCTYPE html>
            <html>
            <head>
                <script type="application/ld+json">
                {
                    "@context": "https://schema.org",
                    "@type": "Product",
                    "name": "Tênis Esportivo Ultra Pro",
                    "description": "Tênis esportivo para corrida de alta performance com amortecimento responsivo.",
                    "sku": "TENIS-ULTRA-01",
                    "brand": {
                        "@type": "Brand",
                        "name": "Nike"
                    },
                    "image": [
                        "https://images.exemplo.com/tenis-1.jpg",
                        "https://images.exemplo.com/tenis-2.jpg"
                    ],
                    "offers": {
                        "@type": "Offer",
                        "price": "499.90",
                        "priceCurrency": "BRL"
                    }
                }
                </script>
            </head>
            <body>
                <h1>Título no H1 ignorado em favor do JSON-LD</h1>
            </body>
            </html>
            """;

        var result = ProductHtmlParser.Parse(html);

        result.Title.Should().Be("Tênis Esportivo Ultra Pro");
        result.Description.Should().Be("Tênis esportivo para corrida de alta performance com amortecimento responsivo.");
        result.Price.Should().Be(499.90m);
        result.Currency.Should().Be("BRL");
        result.MetaAttributes["sku"].Should().Be("TENIS-ULTRA-01");
        result.MetaAttributes["brand"].Should().Be("Nike");
        result.Images.Should().ContainInOrder(
            "https://images.exemplo.com/tenis-1.jpg",
            "https://images.exemplo.com/tenis-2.jpg");
        result.RawDescriptionHtml.Should().Contain("Tênis esportivo para corrida");
    }

    [Fact]
    public void ProductHtmlParser_ShouldExtractFromJsonLdInsideGraph()
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
                            "@type": "WebSite",
                            "name": "Loja Virtual"
                        },
                        {
                            "@type": "Product",
                            "name": "Camisa Casual Slim Fit",
                            "description": "Camisa 100% algodão egípcio.",
                            "offers": {
                                "price": 189.50,
                                "priceCurrency": "USD"
                            }
                        }
                    ]
                }
                </script>
            </head>
            <body></body>
            </html>
            """;

        var result = ProductHtmlParser.Parse(html);

        result.Title.Should().Be("Camisa Casual Slim Fit");
        result.Description.Should().Be("Camisa 100% algodão egípcio.");
        result.Price.Should().Be(189.50m);
        result.Currency.Should().Be("USD");
    }

    [Fact]
    public void ProductHtmlParser_ShouldFallbackToOpenGraphAndMetaTags_WhenJsonLdIsAbsent()
    {
        const string html = """
            <!DOCTYPE html>
            <html>
            <head>
                <meta property="og:title" content="Mochila Executiva Impermeável" />
                <meta property="og:description" content="Mochila com compartimento acolchoado para notebook até 17 polegadas." />
                <meta property="og:image" content="https://img.exemplo.com/mochila.png" />
                <meta property="product:price:amount" content="299,00" />
                <meta property="product:price:currency" content="BRL" />
            </head>
            <body>
                <div class="product-description">
                    <p>Mochila moderna para viagens de negócios com trava antifurto.</p>
                </div>
                <img src="https://img.exemplo.com/detalhe1.jpg" />
                <img src="https://img.exemplo.com/logo-site.png" />
            </body>
            </html>
            """;

        var result = ProductHtmlParser.Parse(html);

        result.Title.Should().Be("Mochila Executiva Impermeável");
        result.Description.Should().Be("Mochila com compartimento acolchoado para notebook até 17 polegadas.");
        result.Price.Should().Be(299.00m);
        result.Currency.Should().Be("BRL");
        result.Images.Should().Contain("https://img.exemplo.com/mochila.png");
        result.Images.Should().Contain("https://img.exemplo.com/detalhe1.jpg");
        result.Images.Should().NotContain("https://img.exemplo.com/logo-site.png");
        result.RawDescriptionHtml.Should().Contain("Mochila moderna para viagens de negócios");
    }

    [Fact]
    public async Task ProductScraper_WhenRequestIsValid_ShouldReturnSuccessEvent()
    {
        const string fakeHtml = """
            <html>
            <head>
                <script type="application/ld+json">
                {
                    "@context": "https://schema.org",
                    "@type": "Product",
                    "name": "Fone Bluetooth Noise Cancelling",
                    "description": "Fone de ouvido sem fio com cancelamento ativo de ruído.",
                    "offers": { "price": 850.00, "priceCurrency": "BRL" }
                }
                </script>
            </head>
            </html>
            """;

        var fakeHandler = new FakeHttpMessageHandler(HttpStatusCode.OK, fakeHtml);
        var httpClient = new HttpClient(fakeHandler);
        var scraper = new ProductScraper(httpClient, NullLogger<ProductScraper>.Instance);

        var tenantId = Guid.NewGuid();
        var request = new ScrapingRequestMessage
        {
            TenantId = tenantId,
            Sku = "FONE-BT-01",
            Url = "https://www.example.com/product/fone",
            PromptContext = "foco em tecnologia",
            IsByok = true
        };

        var response = await scraper.ScrapeAsync(request, CancellationToken.None);

        response.Should().NotBeNull();
        response.Success.Should().BeTrue();
        response.TenantId.Should().Be(tenantId);
        response.Sku.Should().Be("FONE-BT-01");
        response.RawTitle.Should().Be("Fone Bluetooth Noise Cancelling");
        response.Price.Should().Be(850.00m);
        response.Currency.Should().Be("BRL");
        response.IsByok.Should().BeTrue();
        response.ErrorMessage.Should().BeNull();
    }

    [Fact]
    public async Task ProductScraper_WhenUrlIsLocalOrSsrf_ShouldReturnFailureEvent()
    {
        var fakeHandler = new FakeHttpMessageHandler(HttpStatusCode.OK, "<html></html>");
        var httpClient = new HttpClient(fakeHandler);
        var scraper = new ProductScraper(httpClient, NullLogger<ProductScraper>.Instance);

        var request = new ScrapingRequestMessage
        {
            TenantId = Guid.NewGuid(),
            Sku = "HACK-01",
            Url = "http://169.254.169.254/latest/meta-data/",
            IsByok = false
        };

        var response = await scraper.ScrapeAsync(request, CancellationToken.None);

        response.Success.Should().BeFalse();
        response.ErrorMessage.Should().Contain("Anti-SSRF");
        fakeHandler.RequestSentCount.Should().Be(0, "No HTTP request should ever be dispatched for unsafe targets");
    }

    [Fact]
    public async Task ProductScraper_WhenTargetReturns404_ShouldReturnFailureEvent()
    {
        var fakeHandler = new FakeHttpMessageHandler(HttpStatusCode.NotFound, "Not Found");
        var httpClient = new HttpClient(fakeHandler);
        var scraper = new ProductScraper(httpClient, NullLogger<ProductScraper>.Instance);

        var request = new ScrapingRequestMessage
        {
            TenantId = Guid.NewGuid(),
            Sku = "NOTFOUND-01",
            Url = "https://www.example.com/produto-inexistente",
            IsByok = false
        };

        var response = await scraper.ScrapeAsync(request, CancellationToken.None);

        response.Success.Should().BeFalse();
        response.ErrorMessage.Should().Contain("404");
    }

    private sealed class FakeHttpMessageHandler : HttpMessageHandler
    {
        private readonly HttpStatusCode _statusCode;
        private readonly string _responseContent;
        public int RequestSentCount { get; private set; }

        public FakeHttpMessageHandler(HttpStatusCode statusCode, string responseContent)
        {
            _statusCode = statusCode;
            _responseContent = responseContent;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestSentCount++;
            var response = new HttpResponseMessage(_statusCode)
            {
                Content = new StringContent(_responseContent, Encoding.UTF8, "text/html")
            };
            return Task.FromResult(response);
        }
    }
}
