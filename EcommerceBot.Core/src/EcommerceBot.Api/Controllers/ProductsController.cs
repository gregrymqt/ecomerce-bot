using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Products;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers;

[ApiController]
[Route("api/v1/products")]
[Authorize]
public class ProductsController : ControllerBase
{
    private readonly ICatalogService _catalogService;

    public ProductsController(ICatalogService catalogService)
    {
        _catalogService = catalogService;
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

        try
        {
            var result = await _catalogService.RequestScrapingAsync(tenantId, request);
            return Accepted(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }
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
