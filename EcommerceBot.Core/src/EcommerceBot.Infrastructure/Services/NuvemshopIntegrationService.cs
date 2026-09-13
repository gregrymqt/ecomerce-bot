using System;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Nuvemshop;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using EcommerceBot.Infrastructure.Gateways;
using EcommerceBot.Infrastructure.Options;
using MassTransit;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EcommerceBot.Infrastructure.Services;

public sealed class NuvemshopIntegrationService : INuvemshopIntegrationService
{
    private readonly HttpClient _httpClient;
    private readonly IStoreIntegrationRepository _integrationRepository;
    private readonly IAesGcmCryptoService _cryptoService;
    private readonly IEcommerceGatewayFactory _gatewayFactory;
    private readonly IProductRepository _productRepository;
    private readonly IRedisService _redisService;
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly ILogger<NuvemshopIntegrationService> _logger;
    private readonly string _clientId;
    private readonly string _clientSecret;
    private readonly string _redirectUri;
    private readonly string _webhookCallbackUrl;

    public NuvemshopIntegrationService(
        HttpClient httpClient,
        IStoreIntegrationRepository integrationRepository,
        IAesGcmCryptoService cryptoService,
        IEcommerceGatewayFactory gatewayFactory,
        IProductRepository productRepository,
        IRedisService redisService,
        IPublishEndpoint publishEndpoint,
        IOptions<NuvemshopOptions> nuvemshopOptions,
        ILogger<NuvemshopIntegrationService> logger)
    {
        _httpClient = httpClient;
        _integrationRepository = integrationRepository;
        _cryptoService = cryptoService;
        _gatewayFactory = gatewayFactory;
        _productRepository = productRepository;
        _redisService = redisService;
        _publishEndpoint = publishEndpoint;
        _logger = logger;

        var options = nuvemshopOptions.Value;
        _clientId = !string.IsNullOrWhiteSpace(options.ClientId) ? options.ClientId : "default_client_id";
        _clientSecret = !string.IsNullOrWhiteSpace(options.ClientSecret) ? options.ClientSecret : "default_client_secret";
        _redirectUri = !string.IsNullOrWhiteSpace(options.RedirectUri) ? options.RedirectUri : "https://app.ecommercebot.com/api/v1/nuvemshop/oauth/callback";
        _webhookCallbackUrl = !string.IsNullOrWhiteSpace(options.WebhookCallbackUrl) ? options.WebhookCallbackUrl : "https://app.ecommercebot.com/api/v1/nuvemshop/webhooks";
    }

    public string GetOAuthUrl(Guid tenantId)
    {
        return $"https://www.nuvemshop.com.br/apps/authorize/token?client_id={_clientId}&redirect_uri={Uri.EscapeDataString(_redirectUri)}&response_type=code&state={tenantId}";
    }

    public async Task<bool> HandleOAuthCallbackAsync(Guid tenantId, string code, CancellationToken cancellationToken = default)
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
            var response = await _httpClient.SendAsync(request, cancellationToken);
            var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);

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

            return await SaveDirectCredentialsAsync(tenantId, tokenData.UserId.ToString(), tokenData.AccessToken, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing Nuvemshop OAuth callback for Tenant {TenantId}", tenantId);
            return false;
        }
    }

    public async Task<bool> SaveCredentialsAsync(Guid tenantId, NuvemshopCredentialsPayloadDto payload, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(payload.StoreId) || string.IsNullOrWhiteSpace(payload.AccessToken))
            throw new ArgumentException("StoreId e AccessToken são obrigatórios.");

        return await SaveDirectCredentialsAsync(tenantId, payload.StoreId.Trim(), payload.AccessToken.Trim(), cancellationToken);
    }

    private async Task<bool> SaveDirectCredentialsAsync(Guid tenantId, string storeId, string accessToken, CancellationToken cancellationToken = default)
    {
        var encrypted = _cryptoService.Encrypt(accessToken);

        var existing = await _integrationRepository.GetByTenantAndPlatformAsync(tenantId, "NUVEMSHOP", cancellationToken);
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

        await _integrationRepository.UpsertAsync(integration, cancellationToken);
        _logger.LogInformation("Nuvemshop integration saved for Tenant {TenantId} (StoreId: {StoreId})", tenantId, storeId);

        // 1. Executa health check imediato
        try
        {
            var gateway = _gatewayFactory.GetGateway("Nuvemshop");
            var (success, latencyMs, message) = await gateway.HealthCheckAsync(tenantId, cancellationToken);
            await _integrationRepository.UpdateHealthCheckAsync(integration.Id, success ? "CONNECTED" : "ERROR", latencyMs, message, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Initial health check failed for Nuvemshop Tenant {TenantId}", tenantId);
        }

        // 2. Auto-registro de Webhooks essenciais na API da Nuvemshop (1-Clique Handshake)
        _ = Task.Run(async () =>
        {
            try
            {
                await RegisterWebhooksAsync(tenantId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Auto webhook registration failed for Tenant {TenantId}", tenantId);
            }
        });

        return true;
    }

    public async Task<bool> RegisterWebhooksAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            if (_gatewayFactory.GetGateway("Nuvemshop") is not NuvemshopGateway gateway) return false;

            _logger.LogInformation("Triggering automatic webhook registration for Nuvemshop Tenant {TenantId}", tenantId);
            return await gateway.RegisterWebhooksAsync(tenantId, _webhookCallbackUrl, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao registrar webhooks na Nuvemshop para o Tenant {TenantId}", tenantId);
            return false;
        }
    }

    public async Task ProcessWebhookAsync(Guid tenantId, string topic, string eventId, string? resourceId, JsonElement payload, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Processing Nuvemshop Webhook '{Topic}' (Resource: {ResourceId}) for Tenant {TenantId}", topic, resourceId, tenantId);

        try
        {
            if (topic.Equals("app/uninstalled", StringComparison.OrdinalIgnoreCase))
            {
                var integration = await _integrationRepository.GetByTenantAndPlatformAsync(tenantId, "NUVEMSHOP", cancellationToken);
                if (integration != null)
                {
                    integration.Status = "DISCONNECTED";
                    integration.HealthCheckStatus = "App Desinstalado na Nuvemshop";
                    integration.UpdatedAt = DateTimeOffset.UtcNow;
                    await _integrationRepository.UpsertAsync(integration, cancellationToken);
                    _logger.LogInformation("Marked Nuvemshop integration as DISCONNECTED for Tenant {TenantId}", tenantId);
                }
                return;
            }

            // Sincronização Reativa (Fetch-on-Notification) para product/updated
            if (topic.Equals("product/updated", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(resourceId))
            {
                if (_gatewayFactory.GetGateway("Nuvemshop") is NuvemshopGateway gateway)
                {
                    var remoteProduct = await gateway.GetProductByIdAsync(tenantId, resourceId, cancellationToken);
                    if (remoteProduct != null)
                    {
                        var sku = remoteProduct.Variants?.FirstOrDefault()?.Sku;
                        if (!string.IsNullOrEmpty(sku))
                        {
                            var localProduct = await _productRepository.GetBySkuAsync(tenantId, sku, cancellationToken);
                            if (localProduct != null)
                            {
                                var firstVariant = remoteProduct.Variants?.FirstOrDefault();
                                if (firstVariant != null)
                                {
                                    if (decimal.TryParse(firstVariant.Price, NumberStyles.Any, CultureInfo.InvariantCulture, out var price))
                                    {
                                        localProduct.Price = price;
                                    }
                                    localProduct.StockQuantity = firstVariant.Stock ?? 0;
                                    localProduct.NuvemshopProductId = remoteProduct.Id.ToString();
                                    localProduct.NuvemshopVariantId = firstVariant.Id.ToString();
                                    localProduct.UpdatedAt = DateTimeOffset.UtcNow;

                                    await _productRepository.UpdateAsync(localProduct, cancellationToken);
                                    _logger.LogInformation("Reactively synced SKU {Sku} from Nuvemshop Webhook.", sku);

                                    // Dispara SSE para o Frontend
                                    var sseEvent = new
                                    {
                                        type = "NUVEMSHOP_PRODUCT_UPDATED",
                                        sku = sku,
                                        product_id = remoteProduct.Id,
                                        price = localProduct.Price,
                                        stock = localProduct.StockQuantity,
                                        timestamp = DateTimeOffset.UtcNow
                                    };
                                    await _redisService.PublishAsync($"events:tenant:{tenantId}", JsonSerializer.Serialize(sseEvent));
                                }
                            }
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar webhook da Nuvemshop '{Topic}' para o Tenant {TenantId}", topic, tenantId);
            throw;
        }
    }

    public async Task<NuvemshopBulkSyncResponse> TriggerBulkSyncAsync(Guid tenantId, NuvemshopBulkSyncRequest request, CancellationToken cancellationToken = default)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId é obrigatório.", nameof(tenantId));

        if (request.Skus == null || request.Skus.Count == 0)
            throw new ArgumentException("A lista de SKUs não pode estar vazia.", nameof(request));

        var jobId = Guid.NewGuid().ToString("N");

        try
        {
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
                }, cancellationToken);
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
        catch (Exception ex)
        {
            _logger.LogError(ex, "Falha ao enfileirar produtos para sincronização em lote da Nuvemshop. JobId: {JobId}, Tenant: {TenantId}", jobId, tenantId);
            throw;
        }
    }

    public async Task<bool> UpdateInventoryAsync(Guid tenantId, string sku, int quantity, CancellationToken cancellationToken = default)
    {
        try
        {
            var gateway = _gatewayFactory.GetGateway("Nuvemshop");
            return await gateway.UpdateInventoryAsync(tenantId, sku, quantity, cancellationToken: cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao atualizar estoque na Nuvemshop para SKU {Sku}, Tenant {TenantId}", sku, tenantId);
            return false;
        }
    }

    public async Task<bool> UpdateProductStatusAsync(Guid tenantId, string sku, string status, CancellationToken cancellationToken = default)
    {
        try
        {
            var gateway = _gatewayFactory.GetGateway("Nuvemshop");
            return await gateway.UpdateProductStatusAsync(tenantId, sku, status, cancellationToken: cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao atualizar status na Nuvemshop para SKU {Sku}, Tenant {TenantId}", sku, tenantId);
            return false;
        }
    }

    public async Task<bool> DeleteRemoteProductAsync(Guid tenantId, string sku, CancellationToken cancellationToken = default)
    {
        try
        {
            var gateway = _gatewayFactory.GetGateway("Nuvemshop");
            return await gateway.DeleteProductAsync(tenantId, sku, cancellationToken: cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao remover produto na Nuvemshop para SKU {Sku}, Tenant {TenantId}", sku, tenantId);
            return false;
        }
    }
}
