using System;
using System.Net.Http;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using EcommerceBot.Application.DTOs.Analytics;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Services;

public class TrafficAnalyticsService : ITrafficAnalyticsService
{
    private readonly ITrafficAttributionRepository _attributionRepository;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<TrafficAnalyticsService> _logger;

    public TrafficAnalyticsService(
        ITrafficAttributionRepository attributionRepository,
        IHttpClientFactory httpClientFactory,
        ILogger<TrafficAnalyticsService> logger)
    {
        _attributionRepository = attributionRepository;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<Guid> RecordTenantVisitAsync(RecordTenantVisitRequestDto request, string? ipAddress, string? userAgent)
    {
        var attribution = new TrafficAttribution
        {
            Id = Guid.NewGuid(),
            TenantId = request.TenantId,
            SessionId = string.IsNullOrWhiteSpace(request.SessionId) ? Guid.NewGuid().ToString("N") : request.SessionId,
            UtmSource = request.UtmSource,
            UtmMedium = request.UtmMedium,
            UtmCampaign = request.UtmCampaign,
            UtmTerm = request.UtmTerm,
            UtmContent = request.UtmContent,
            AdId = request.AdId,
            FbClid = request.FbClid,
            GClid = request.GClid,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            CreatedAt = DateTimeOffset.UtcNow
        };

        return await _attributionRepository.RecordTenantVisitAsync(attribution);
    }

    public async Task<TenantTrafficOverviewDto> GetTenantTrafficOverviewAsync(Guid tenantId, int days = 30, string? sourceFilter = null)
    {
        return await _attributionRepository.GetTenantTrafficOverviewAsync(tenantId, days, sourceFilter);
    }

    public async Task<VerifyTagResponseDto> VerifyStoreTagAsync(Guid tenantId, string storeUrl)
    {
        if (string.IsNullOrWhiteSpace(storeUrl))
        {
            return new VerifyTagResponseDto
            {
                IsInstalled = false,
                StoreUrl = storeUrl,
                CheckedAt = DateTimeOffset.UtcNow,
                Message = "A URL da loja é obrigatória."
            };
        }

        // Validação Anti-SSRF (regras de production-security)
        if (!Uri.TryCreate(storeUrl, UriKind.Absolute, out var uri) || 
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            return new VerifyTagResponseDto
            {
                IsInstalled = false,
                StoreUrl = storeUrl,
                CheckedAt = DateTimeOffset.UtcNow,
                Message = "URL inválida. Apenas esquemas HTTP/HTTPS são permitidos."
            };
        }

        var host = uri.Host.ToLowerInvariant();
        if (host == "localhost" || host == "127.0.0.1" || host == "::1" || host.StartsWith("10.") || host.StartsWith("192.168.") || host == "169.254.169.254")
        {
            return new VerifyTagResponseDto
            {
                IsInstalled = false,
                StoreUrl = storeUrl,
                CheckedAt = DateTimeOffset.UtcNow,
                Message = "Endereço restrito ou loopback não é permitido para verificação."
            };
        }

        try
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(10);
            client.DefaultRequestHeaders.Add("User-Agent", "ECom-Auto-Bot-TagVerifier/1.0");

            var response = await client.GetAsync(uri);
            if (!response.IsSuccessStatusCode)
            {
                return new VerifyTagResponseDto
                {
                    IsInstalled = false,
                    StoreUrl = storeUrl,
                    CheckedAt = DateTimeOffset.UtcNow,
                    Message = $"Não foi possível acessar a loja (HTTP {(int)response.StatusCode})."
                };
            }

            var html = await response.Content.ReadAsStringAsync();
            var tenantStr = tenantId.ToString().ToLowerInvariant();

            // Verifica se a tag tracker.js ou o tenant_id estão presentes no DOM da loja
            var isPresent = html.Contains("tracker.js", StringComparison.OrdinalIgnoreCase) || 
                            html.Contains(tenantStr, StringComparison.OrdinalIgnoreCase) ||
                            html.Contains("data-tenant-id", StringComparison.OrdinalIgnoreCase);

            return new VerifyTagResponseDto
            {
                IsInstalled = isPresent,
                StoreUrl = storeUrl,
                CheckedAt = DateTimeOffset.UtcNow,
                Message = isPresent 
                    ? "Tag de rastreamento instalada e verificada com sucesso!" 
                    : "Tag de rastreamento não encontrada no HTML da loja. Certifique-se de colá-la na tag <head> do seu tema."
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao verificar tag da loja {StoreUrl} para tenant {TenantId}", storeUrl, tenantId);
            return new VerifyTagResponseDto
            {
                IsInstalled = false,
                StoreUrl = storeUrl,
                CheckedAt = DateTimeOffset.UtcNow,
                Message = "Falha ao conectar com o site da loja para validar a tag."
            };
        }
    }
}
