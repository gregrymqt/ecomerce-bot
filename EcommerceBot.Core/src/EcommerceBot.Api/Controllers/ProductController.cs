using System;
using System.Threading.Tasks;
using MassTransit;
using Microsoft.AspNetCore.Mvc;
using EcommerceBot.Application.DTOs.Messaging;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Api.Controllers;

[ApiController]
[Route("api/v1/products")]
public class ProductController : ControllerBase
{
    private readonly ITenantContext _tenantContext;
    private readonly IProductRepository _productRepository;
    private readonly ITenantRepository _tenantRepository;
    private readonly IPublishEndpoint _publishEndpoint;

    public ProductController(
        ITenantContext tenantContext, 
        IProductRepository productRepository, 
        ITenantRepository tenantRepository,
        IPublishEndpoint publishEndpoint)
    {
        _tenantContext = tenantContext;
        _productRepository = productRepository;
        _tenantRepository = tenantRepository;
        _publishEndpoint = publishEndpoint;
    }

    [HttpGet]
    public async Task<IActionResult> GetProducts([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var tenantId = _tenantContext.TenantId;
        var products = await _productRepository.GetProductsAsync(tenantId, page, pageSize);
        return Ok(products);
    }

    [HttpPost("scrape")]
    public async Task<IActionResult> RequestScraping([FromBody] ScrapingRequest request)
    {
        var tenantId = _tenantContext.TenantId;

        // 1. Validar e Deduzir créditos (Exemplo rápido de bloqueio)
        if (!await _tenantRepository.HasCreditsAsync(tenantId, 1))
        {
            return BadRequest(new { detail = "Créditos insuficientes para realizar o scraping com IA." });
        }
        await _tenantRepository.DeductCreditsAsync(tenantId, 1);

        // 2. Salvar o Produto inicial como "RAW" no Dapper
        var sku = Guid.NewGuid().ToString("N").Substring(0, 10).ToUpper(); // Gerar Sku Temporário/Amigável
        
        var product = new Product
        {
            TenantId = tenantId,
            Sku = sku,
            Title = request.Title ?? "Produto a ser analisado",
            SourceUrl = request.Url,
            Status = "RAW"
        };
        
        await _productRepository.AddAsync(product);

        // 3. Disparar Evento para o Worker Python através do RabbitMQ (MassTransit)
        await _publishEndpoint.Publish(new ScrapingRequestMessage
        {
            TenantId = tenantId,
            Sku = sku,
            Url = request.Url,
            PromptContext = request.CustomPrompt ?? string.Empty
        });

        return Accepted(new { 
            message = "Scraping solicitado com sucesso.",
            sku = sku,
            status = "PROCESSING" 
        });
    }
}

public class ScrapingRequest
{
    public string Url { get; set; } = string.Empty;
    public string? Title { get; set; }
    public string? CustomPrompt { get; set; }
}
