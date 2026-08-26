using System;
using System.Net;
using System.Net.Sockets;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Messaging;
using EcommerceBot.Application.DTOs.Products;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using MassTransit;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers;

[ApiController]
[Route("api/v1/products")]
[Authorize]
public class ProductsController : ControllerBase
{
    private readonly ICatalogService _catalogService;
    private readonly IProductRepository _productRepository;
    private readonly ITenantRepository _tenantRepository;
    private readonly IPublishEndpoint _publishEndpoint;

    public ProductsController(
        ICatalogService catalogService,
        IProductRepository productRepository,
        ITenantRepository tenantRepository,
        IPublishEndpoint publishEndpoint)
    {
        _catalogService = catalogService;
        _productRepository = productRepository;
        _tenantRepository = tenantRepository;
        _publishEndpoint = publishEndpoint;
    }

    private static bool IsSafePublicUrl(string urlString)
    {
        if (!Uri.TryCreate(urlString, UriKind.Absolute, out var uri))
            return false;

        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            return false;

        var host = uri.DnsSafeHost.ToLowerInvariant();
        if (host == "localhost" || host.EndsWith(".localhost") || host.EndsWith(".local"))
            return false;

        if (IPAddress.TryParse(host, out var ip))
        {
            if (IPAddress.IsLoopback(ip)) return false;

            var bytes = ip.GetAddressBytes();
            if (ip.AddressFamily == AddressFamily.InterNetwork)
            {
                if (bytes[0] == 10) return false;
                if (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) return false;
                if (bytes[0] == 192 && bytes[1] == 168) return false;
                if (bytes[0] == 169 && bytes[1] == 254) return false;
                if (bytes[0] == 0) return false;
            }
        }

        return true;
    }

    [HttpGet]
    public async Task<IActionResult> ListProducts(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromQuery(Name = "status")] string? statusFilter = null,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20)
    {
        if (tenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID is required");

        var response = await _catalogService.GetProductsAsync(tenantId, statusFilter, search, page, limit);
        return Ok(response);
    }

    [HttpPost("scrape")]
    public async Task<IActionResult> RequestScraping(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromBody] ScrapingRequestDto request)
    {
        if (tenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID is required");

        if (string.IsNullOrWhiteSpace(request.Url) || !IsSafePublicUrl(request.Url))
            return BadRequest(new { detail = "URL inválida ou bloqueada por política de segurança Anti-SSRF." });

        if (!await _tenantRepository.HasCreditsAsync(tenantId, 1))
        {
            return BadRequest(new { detail = "Créditos insuficientes para realizar o scraping com IA." });
        }
        await _tenantRepository.DeductCreditsAsync(tenantId, 1);

        var sku = Guid.NewGuid().ToString("N").Substring(0, 10).ToUpper();

        var product = new Product
        {
            TenantId = tenantId,
            Sku = sku,
            Title = request.Title ?? "Produto a ser analisado",
            SourceUrl = request.Url,
            Status = "RAW"
        };

        await _productRepository.AddAsync(product);

        await _publishEndpoint.Publish(new ScrapingRequestMessage
        {
            TenantId = tenantId,
            Sku = sku,
            Url = request.Url,
            PromptContext = request.CustomPrompt ?? string.Empty
        });

        return Accepted(new
        {
            message = "Scraping solicitado com sucesso.",
            sku = sku,
            status = "PROCESSING"
        });
    }

    [HttpPatch("{sku}")]
    public async Task<IActionResult> UpdateProduct(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        string sku,
        [FromBody] ProductUpdateDto payload)
    {
        if (tenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID is required");

        var result = await _catalogService.UpdateProductAsync(tenantId, sku, payload);
        if (result == null)
            return NotFound($"Product with SKU '{sku}' not found.");

        return Ok(result);
    }

    [HttpDelete("{sku}")]
    public async Task<IActionResult> DeleteProduct(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        string sku)
    {
        if (tenantId == Guid.Empty)
            return BadRequest("X-Tenant-ID is required");

        var deleted = await _catalogService.DeleteProductAsync(tenantId, sku);
        if (!deleted)
            return NotFound($"Product with SKU '{sku}' not found.");

        return Ok(new { message = "Product deleted successfully" });
    }
}

public class ScrapingRequestDto
{
    public string Url { get; set; } = string.Empty;
    public string? Title { get; set; }
    public string? CustomPrompt { get; set; }
}
