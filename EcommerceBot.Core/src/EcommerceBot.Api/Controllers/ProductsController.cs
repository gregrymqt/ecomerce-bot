using System;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Api.Filters;
using EcommerceBot.Application.DTOs.Products;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/products")]
public class ProductsController : BaseApiController
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
        [FromQuery] int limit = 20,
        CancellationToken cancellationToken = default)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequestProblem("O header X-Tenant-ID é obrigatório.");

        var response = await _catalogService.GetProductsAsync(activeTenantId, statusFilter, search, page, limit, cancellationToken);
        return Ok(response);
    }

    [HttpPost("scrape")]
    [RateLimit(MaxRequests = 30, WindowSeconds = 60, BlockDurationSeconds = 300)]
    public async Task<IActionResult> RequestScraping(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        [FromBody] ScrapingRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequestProblem("O header X-Tenant-ID é obrigatório.");

        try
        {
            var result = await _catalogService.RequestScrapingAsync(activeTenantId, request, cancellationToken);
            return Accepted(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequestProblem(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return ConflictProblem(ex.Message);
        }
    }

    [HttpPatch("{sku}")]
    public async Task<IActionResult> UpdateProduct(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        string sku,
        [FromBody] ProductUpdateDto payload,
        CancellationToken cancellationToken = default)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequestProblem("O header X-Tenant-ID é obrigatório.");

        var result = await _catalogService.UpdateProductAsync(activeTenantId, sku, payload, cancellationToken);
        if (result == null)
            return NotFoundProblem($"Produto com SKU '{sku}' não encontrado.");

        return Ok(result);
    }

    [HttpDelete("{sku}")]
    public async Task<IActionResult> DeleteProduct(
        [FromHeader(Name = "X-Tenant-ID")] Guid tenantId,
        string sku,
        CancellationToken cancellationToken = default)
    {
        var activeTenantId = tenantId != Guid.Empty ? tenantId : CurrentTenantId;
        if (activeTenantId == Guid.Empty)
            return BadRequestProblem("O header X-Tenant-ID é obrigatório.");

        var deleted = await _catalogService.DeleteProductAsync(activeTenantId, sku, cancellationToken);
        if (!deleted)
            return NotFoundProblem($"Produto com SKU '{sku}' não encontrado.");

        return Ok(new { message = "Produto excluído com sucesso." });
    }
}
