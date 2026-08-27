using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Nuvemshop;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using MassTransit;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

public class NuvemshopIntegrationService : INuvemshopIntegrationService
{
    private readonly HttpClient _httpClient;
    private readonly IStoreIntegrationRepository _integrationRepository;
    private readonly IAesGcmCryptoService _cryptoService;
    private readonly IEcommerceGatewayFactory _gatewayFactory;
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly ILogger<NuvemshopIntegrationService> _logger;
    private readonly string _clientId;
    private readonly string _clientSecret;
    private readonly string _redirectUri;

    public NuvemshopIntegrationService(
        HttpClient httpClient,
        IStoreIntegrationRepository integrationRepository,
        IAesGcmCryptoService cryptoService,
        IEcommerceGatewayFactory gatewayFactory,
        IPublishEndpoint publishEndpoint,
        IConfiguration config,
        ILogger<NuvemshopIntegrationService> logger)
    {
        _httpClient = httpClient;
        _integrationRepository = integrationRepository;
        _cryptoService = cryptoService;
        _gatewayFactory = gatewayFactory;
        _publishEndpoint = publishEndpoint;
        _logger = logger;

        _clientId = config["Nuvemshop:ClientId"] ?? "default_client_id";
        _clientSecret = config["Nuvemshop:ClientSecret"] ?? "default_client_secret";
        _redirectUri = config["Nuvemshop:RedirectUri"] ?? "https://app.ecommercebot.com/api/v1/nuvemshop/oauth/callback";
    }

    public string GetOAuthUrl(Guid tenantId)
    {
        return $"https://www.nuvemshop.com.br/apps/authorize/token?client_id={_clientId}&redirect_uri={Uri.EscapeDataString(_redirectUri)}&response_type=code&state={tenantId}";
    }

    public async Task<bool> HandleOAuthCallbackAsync(Guid tenantId, string code)
    {
        _logger.LogInformation("Exchanging OAuth code for Tenant {TenantId}", tenantId);

        var tokenUrl = "https://www.nuvemshop.com.br/apps/authorize/token";
        var payload = new
        {
            client_id = _clientId,
            client_secret = _clientSecret,
            grant_type = "authorization_code",
            code = code
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, tokenUrl);
        request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        try
        {
            var response = await _httpClient.SendAsync(request);
            var responseContent = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Nuvemshop OAuth exchange failed for Tenant {TenantId}: {Error}", tenantId, responseContent);
                return false;
            }

            var tokenData = JsonSerializer.Deserialize<NuvemshopOAuthTokenResponse>(responseContent);
            if (tokenData == null || string.IsNullOrEmpty(tokenData.AccessToken) || tokenData.UserId <= 0)
            {
                _logger.LogError("Invalid OAuth token response for Tenant {TenantId}", tenantId);
                return false;
            }

            return await SaveDirectCredentialsAsync(tenantId, tokenData.UserId.ToString(), tokenData.AccessToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing Nuvemshop OAuth callback for Tenant {TenantId}", tenantId);
            return false;
        }
    }

    public async Task<bool> SaveCredentialsAsync(Guid tenantId, NuvemshopCredentialsPayloadDto payload)
    {
        if (string.IsNullOrWhiteSpace(payload.StoreId) || string.IsNullOrWhiteSpace(payload.AccessToken))
            throw new ArgumentException("StoreId e AccessToken são obrigatórios.");

        return await SaveDirectCredentialsAsync(tenantId, payload.StoreId.Trim(), payload.AccessToken.Trim());
    }

    private async Task<bool> SaveDirectCredentialsAsync(Guid tenantId, string storeId, string accessToken)
    {
        var encrypted = _cryptoService.Encrypt(accessToken);

        var existing = await _integrationRepository.GetByTenantAndPlatformAsync(tenantId, "NUVEMSHOP");
        var integration = existing ?? new StoreIntegration
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Platform = "NUVEMSHOP",
            CreatedAt = DateTimeOffset.UtcNow
        };

        integration.StoreDomain = storeId;
        integration.EncryptedAccessToken = encrypted.CipherText;
        integration.InitializationVector = encrypted.Nonce;
        integration.AuthTag = encrypted.Tag;
        integration.Status = "CONNECTED";
        integration.HealthCheckStatus = "Conexão Nuvemshop Ativa";
        integration.UpdatedAt = DateTimeOffset.UtcNow;

        await _integrationRepository.UpsertAsync(integration);
        _logger.LogInformation("Nuvemshop integration saved for Tenant {TenantId} (StoreId: {StoreId})", tenantId, storeId);

        // Executa health check imediato
        try
        {
            var gateway = _gatewayFactory.GetGateway("Nuvemshop");
            var (success, latencyMs, message) = await gateway.HealthCheckAsync(tenantId);
            await _integrationRepository.UpdateHealthCheckAsync(integration.Id, success ? "CONNECTED" : "ERROR", latencyMs, message);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Initial health check failed for Nuvemshop Tenant {TenantId}", tenantId);
        }

        return true;
    }

    public async Task ProcessWebhookAsync(Guid tenantId, string topic, string eventId, JsonElement payload)
    {
        _logger.LogInformation("Processing Nuvemshop Webhook '{Topic}' for Tenant {TenantId}", topic, tenantId);

        if (topic.Equals("app/uninstalled", StringComparison.OrdinalIgnoreCase))
        {
            var integration = await _integrationRepository.GetByTenantAndPlatformAsync(tenantId, "NUVEMSHOP");
            if (integration != null)
            {
                integration.Status = "DISCONNECTED";
                integration.HealthCheckStatus = "App Desinstalado na Nuvemshop";
                integration.UpdatedAt = DateTimeOffset.UtcNow;
                await _integrationRepository.UpsertAsync(integration);
                _logger.LogInformation("Marked Nuvemshop integration as DISCONNECTED for Tenant {TenantId}", tenantId);
            }
        }
    }

    public async Task<NuvemshopBulkSyncResponse> TriggerBulkSyncAsync(Guid tenantId, NuvemshopBulkSyncRequest request)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId é obrigatório.", nameof(tenantId));

        if (request.Skus == null || request.Skus.Count == 0)
            throw new ArgumentException("A lista de SKUs não pode estar vazia.", nameof(request));

        var jobId = Guid.NewGuid().ToString("N");

        foreach (var sku in request.Skus)
        {
            var msg = new NuvemshopBulkSyncMessage
            {
                JobId = jobId,
                TenantId = tenantId,
                Sku = sku,
                ForceUpdate = request.ForceUpdate,
                Visibility = request.Visibility
            };

            await _publishEndpoint.Publish(msg, context =>
            {
                context.SetRoutingKey("nuvemshop_bulk_sync");
            });
        }

        _logger.LogInformation("Enqueued {Count} products for Nuvemshop sync. JobId: {JobId}", request.Skus.Count, jobId);

        return new NuvemshopBulkSyncResponse
        {
            JobId = jobId,
            TotalEnqueued = request.Skus.Count,
            Status = "queued",
            Message = $"{request.Skus.Count} produtos enviados para a fila de sincronização da Nuvemshop."
        };
    }

    public async Task<bool> UpdateInventoryAsync(Guid tenantId, string sku, int quantity)
    {
        var gateway = _gatewayFactory.GetGateway("Nuvemshop");
        return await gateway.UpdateInventoryAsync(tenantId, sku, quantity);
    }

    public async Task<bool> UpdateProductStatusAsync(Guid tenantId, string sku, string status)
    {
        var gateway = _gatewayFactory.GetGateway("Nuvemshop");
        return await gateway.UpdateProductStatusAsync(tenantId, sku, status);
    }

    public async Task<bool> DeleteRemoteProductAsync(Guid tenantId, string sku)
    {
        var gateway = _gatewayFactory.GetGateway("Nuvemshop");
        return await gateway.DeleteProductAsync(tenantId, sku);
    }
}
