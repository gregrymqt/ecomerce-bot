namespace EcommerceBot.Infrastructure.Scraping;

using System;
using System.Buffers;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using System.Security;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Messaging;
using EcommerceBot.Application.Interfaces;
using Microsoft.Extensions.Logging;

/// <summary>
/// Implementação de alta performance do scraper de produtos C# (.NET 9) com proteção
/// estrita Anti-SSRF, DNS Rebinding prevention e extração híbrida de dados de e-commerce.
/// </summary>
public sealed class ProductScraper : IProductScraper
{
    private const int MaxResponseBytes = 10 * 1024 * 1024; // 10 MB limit contra memory blowup
    private readonly HttpClient _httpClient;
    private readonly ILogger<ProductScraper> _logger;

    public ProductScraper(HttpClient httpClient, ILogger<ProductScraper> logger)
    {
        _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<ScrapedRawProductEvent> ScrapeAsync(ScrapingRequestMessage request, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (request.TenantId == Guid.Empty || string.IsNullOrWhiteSpace(request.Url))
        {
            return CreateFailureEvent(request, "Invalid request: TenantId or URL is missing.");
        }

        try
        {
            // 1. Validação prévia de formato e Anti-SSRF na URL
            var uri = AntiSsrfValidator.ValidateUrlSafety(request.Url);

            _logger.LogInformation("Iniciando scraping seguro para Tenant {TenantId}, SKU {Sku}, URL {Url}",
                request.TenantId, request.Sku, request.Url);

            // 2. Cria requisição HTTP com headers de navegação real
            using var req = new HttpRequestMessage(HttpMethod.Get, uri);
            req.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
            req.Headers.TryAddWithoutValidation("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8");
            req.Headers.TryAddWithoutValidation("Accept-Language", "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7");
            req.Headers.TryAddWithoutValidation("Cache-Control", "no-cache");

            using var response = await _httpClient.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);

            if (!response.IsSuccessStatusCode)
            {
                var errorMsg = $"Target server returned status code {(int)response.StatusCode} ({response.ReasonPhrase})";
                _logger.LogWarning("Falha HTTP no scraping de {Url}: {Error}", request.Url, errorMsg);
                return CreateFailureEvent(request, errorMsg);
            }

            // 3. Lê o corpo da resposta com limite rígido de 10 MB usando buffer do ArrayPool<byte>
            var rentedBuffer = ArrayPool<byte>.Shared.Rent(MaxResponseBytes);
            ProductHtmlParser.ParsedProduct parsed;
            try
            {
                await using var stream = await response.Content.ReadAsStreamAsync(ct);
                int totalBytesRead = await ReadStreamWithLimitAsync(stream, rentedBuffer, MaxResponseBytes, ct);
                var utf8Span = new ReadOnlySpan<byte>(rentedBuffer, 0, totalBytesRead);

                // 4. Caminho rápido: extração direta do JSON-LD em UTF-8 com Span (zero cópia)
                if (!ProductPayloadExtractor.TryExtractFromJsonLd(utf8Span, out var fastProduct) ||
                    string.IsNullOrWhiteSpace(fastProduct.Title))
                {
                    // Fallback: decodifica string UTF-16 e executa parser completo (DOM / Meta Tags)
                    var html = Encoding.UTF8.GetString(utf8Span);
                    parsed = ProductHtmlParser.Parse(html);
                }
                else
                {
                    parsed = fastProduct;
                }
            }
            finally
            {
                ArrayPool<byte>.Shared.Return(rentedBuffer);
            }

            _logger.LogInformation("Scraping concluído com sucesso para Tenant {TenantId}, SKU {Sku}. Título: '{Title}', Preço: {Price} {Currency}",
                request.TenantId, request.Sku, parsed.Title, parsed.Price, parsed.Currency);

            return new ScrapedRawProductEvent
            {
                TenantId = request.TenantId,
                Sku = request.Sku,
                Url = request.Url,
                RawTitle = parsed.Title,
                RawDescriptionHtml = parsed.RawDescriptionHtml,
                RawMarkdown = parsed.RawMarkdown,
                Price = parsed.Price,
                Currency = parsed.Currency,
                Images = parsed.Images,
                MetaAttributes = parsed.MetaAttributes,
                PromptContext = request.PromptContext,
                IsByok = request.IsByok,
                Success = true,
                ErrorMessage = null
            };
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            _logger.LogWarning("Scraping da URL {Url} cancelado por encerramento ou timeout.", request.Url);
            throw;
        }
        catch (SecurityException secEx)
        {
            _logger.LogWarning(secEx, "Bloqueio de segurança Anti-SSRF para {Url}: {Message}", request.Url, secEx.Message);
            return CreateFailureEvent(request, $"Anti-SSRF security block: {secEx.Message}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro inesperado ao executar scraping de {Url} para Tenant {TenantId}", request.Url, request.TenantId);
            return CreateFailureEvent(request, $"Scraping failed: {ex.Message}");
        }
    }

    /// <summary>
    /// Fábrica de SocketsHttpHandler seguro com validação Anti-SSRF antes de cada conexão TCP,
    /// prevenindo ataques de SSRF e DNS Rebinding.
    /// </summary>
    public static SocketsHttpHandler CreateSafeSocketsHttpHandler(TimeSpan? connectTimeout = null)
    {
        return new SocketsHttpHandler
        {
            AllowAutoRedirect = true,
            MaxAutomaticRedirections = 5,
            ConnectTimeout = connectTimeout ?? TimeSpan.FromSeconds(10),
            ConnectCallback = async (context, ct) =>
            {
                var host = context.DnsEndPoint.Host;
                var port = context.DnsEndPoint.Port;

                var ips = await Dns.GetHostAddressesAsync(host, ct);
                if (ips.Length == 0)
                    throw new InvalidOperationException($"No IP addresses resolved for host '{host}'");

                foreach (var ip in ips)
                {
                    AntiSsrfValidator.EnsurePublicIP(ip);
                }

                var socket = new Socket(SocketType.Stream, ProtocolType.Tcp)
                {
                    NoDelay = true
                };

                try
                {
                    await socket.ConnectAsync(ips, port, ct);
                    return new NetworkStream(socket, ownsSocket: true);
                }
                catch
                {
                    socket.Dispose();
                    throw;
                }
            }
        };
    }

    private static async Task<int> ReadStreamWithLimitAsync(Stream stream, byte[] buffer, int maxBytes, CancellationToken ct)
    {
        int totalBytesRead = 0;
        int bytesRead;

        while (totalBytesRead < maxBytes &&
               (bytesRead = await stream.ReadAsync(buffer.AsMemory(totalBytesRead, Math.Min(81920, maxBytes - totalBytesRead)), ct)) > 0)
        {
            totalBytesRead += bytesRead;
        }

        return totalBytesRead;
    }

    private static ScrapedRawProductEvent CreateFailureEvent(ScrapingRequestMessage req, string error)
    {
        return new ScrapedRawProductEvent
        {
            TenantId = req.TenantId,
            Sku = req.Sku,
            Url = req.Url,
            RawTitle = string.Empty,
            RawDescriptionHtml = string.Empty,
            RawMarkdown = string.Empty,
            Price = null,
            Currency = "BRL",
            Images = new(),
            MetaAttributes = new(),
            PromptContext = req.PromptContext,
            IsByok = req.IsByok,
            Success = false,
            ErrorMessage = error
        };
    }
}
