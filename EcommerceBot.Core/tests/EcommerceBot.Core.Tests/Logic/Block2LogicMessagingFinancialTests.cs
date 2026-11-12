using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Ai;
using EcommerceBot.Application.DTOs.MercadoPago;
using EcommerceBot.Application.DTOs.Messaging;
using EcommerceBot.Application.DTOs.OpenRouter;
using EcommerceBot.Application.DTOs.Products;
using EcommerceBot.Application.DTOs.Wallet;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Application.Interfaces.Gateways;
using EcommerceBot.Application.Interfaces.Services;
using EcommerceBot.Core.Tests.Security;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using EcommerceBot.Infrastructure.Gateways;
using EcommerceBot.Infrastructure.Messaging;
using EcommerceBot.Infrastructure.Options;
using EcommerceBot.Infrastructure.Services;
using EcommerceBot.Infrastructure.Utils;
using FluentAssertions;
using MassTransit;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using StackExchange.Redis;
using Xunit;
using Order = EcommerceBot.Domain.Entities.Order;

namespace EcommerceBot.Core.Tests.Logic;

public sealed class Block2LogicMessagingFinancialTests
{
    private const string MpWebhookSecret = "mp_super_secret_webhook_key";

    // =========================================================================
    // LOG-01 & LOG-05: CatalogService envio em exchange:ecommerce + estorno + BYOK
    // =========================================================================

    [Fact]
    public async Task CatalogService_RequestScrapingAsync_SendsToExchangeEcommerce_AndRefundsOnSendFailure()
    {
        var tenantId = Guid.NewGuid();
        var userRepo = new InMemoryUserRepository();
        var tenantRepo = new InMemoryTenantRepository(userRepo);
        tenantRepo.Tenants[tenantId] = new Tenant { Id = tenantId, Name = "Loja Teste", IsActive = true, CreditsBalance = 5 };
        var productRepo = new RecordingProductRepository();
        var credentialRepo = new InMemoryTenantAiCredentialRepository();

        // Credencial SHOPIFY ativa NÃO deve contar como BYOK OpenRouter
        await credentialRepo.UpsertAsync(new TenantAiCredential
        {
            TenantId = tenantId,
            Provider = "SHOPIFY",
            EncryptedApiKey = Encoding.UTF8.GetBytes("shpat_abc|loja.myshopify.com"),
            InitializationVector = [1],
            AuthTag = [2],
            IsActive = true
        });

        var sendProvider = new RecordingSendEndpointProvider();
        var service = new CatalogService(
            productRepo,
            tenantRepo,
            credentialRepo,
            sendProvider,
            NullLogger<CatalogService>.Instance);

        var resp = await service.RequestScrapingAsync(tenantId, new ScrapingRequestDto
        {
            Url = "https://93.184.216.34/produto-teste",
            Title = "Produto Teste"
        });

        resp.Status.Should().Be("PROCESSING");
        sendProvider.SentMessages.Should().ContainSingle();
        var (address, payload) = sendProvider.SentMessages[0];
        address.ToString().Should().Be("exchange:ecommerce");
        var scrapingMsg = payload.Should().BeOfType<ScrapingRequestMessage>().Subject;
        scrapingMsg.IsByok.Should().BeFalse();
        scrapingMsg.TenantId.Should().Be(tenantId);
        scrapingMsg.Sku.Should().Be(resp.Sku);

        // Falha no envio ao RabbitMQ deve estornar com type='REFUND' (compatível com CK_CreditTransactions_Type)
        sendProvider.ThrowOnSend = new InvalidOperationException("RabbitMQ down");
        var act = () => service.RequestScrapingAsync(tenantId, new ScrapingRequestDto
        {
            Url = "https://93.184.216.34/produto-falha",
            Title = "Produto Falha"
        });

        await act.Should().ThrowAsync<InvalidOperationException>();
        tenantRepo.Transactions.Should().Contain(t => t.TenantId == tenantId && t.Type == "REFUND" && t.Amount == 1);
    }

    // =========================================================================
    // LOG-03: Validação de plano e preço no WalletService
    // =========================================================================

    [Fact]
    public async Task WalletService_CreateRechargeAsync_RejectsUnknownPackage_AndUnderpricedAmount()
    {
        var tenantId = Guid.NewGuid();
        var planId = Guid.NewGuid();
        var planRepo = new InMemoryPlanRepository();
        planRepo.Plans[planId] = new Plan
        {
            Id = planId,
            Name = "Starter 500",
            Price = 149.00m,
            CreditsIncluded = 500,
            IsActive = true
        };

        var userRepo = new InMemoryUserRepository();
        var tenantRepo = new InMemoryTenantRepository(userRepo);
        tenantRepo.Tenants[tenantId] = new Tenant { Id = tenantId, Name = "Loja", IsActive = true };

        var walletService = new WalletService(
            tenantRepo,
            planRepo,
            new InMemoryOrderRepository(),
            new FakeMercadoPagoGateway(),
            new FakeBillingProfileRepository(),
            NullLogger<WalletService>.Instance,
            new WalletUtils(),
            userRepo);

        // 1. PackageId inexistente não deve fazer fallback para outro plano
        var unknownPkgAct = () => walletService.CreateRechargeAsync(tenantId, new CreateRechargeRequestDto
        {
            Amount = 10.00m,
            PackageId = "pacote-inexistente",
            PaymentMethod = "pix"
        });
        await unknownPkgAct.Should().ThrowAsync<ArgumentException>();

        // 2. Valor inferior ao preço do plano deve ser rejeitado
        var tamperAct = () => walletService.CreateRechargeAsync(tenantId, new CreateRechargeRequestDto
        {
            Amount = 0.01m,
            PackageId = planId.ToString(),
            PaymentMethod = "pix"
        });
        await tamperAct.Should().ThrowAsync<ArgumentException>();
    }

    // =========================================================================
    // LOG-03: MercadoPagoWebhookService (data.id numérico e rollback de idempotência)
    // =========================================================================

    [Fact]
    public async Task MercadoPagoWebhookService_ParsesNumericId_AndRollsBackIdempotencyIfPublishFails()
    {
        var redis = new InMemoryRedisService();
        var publish = new FlakyPublishEndpoint { FailCount = 1 };
        var webhookService = new MercadoPagoWebhookService(
            redis,
            publish,
            Options.Create(new MercadoPagoOptions { WebhookSecret = MpWebhookSecret }),
            NullLogger<MercadoPagoWebhookService>.Instance);

        var resourceId = "987654321";
        var rawBody = $"{{\"action\":\"payment.updated\",\"data\":{{\"id\":{resourceId}}}}}";
        // Assina sem data.id na query para exercitar a extração numérica do body (L102) + rollback de idempotência
        var xSig = ComputeMpSignature(string.Empty, "req-1", MpWebhookSecret);

        // 1a chamada: Publish falha -> chave de idempotência removida para não engolir retentativa
        var first = await webhookService.ProcessWebhookAsync(rawBody, null, null, xSig, "req-1");
        first.Status.Should().Be(WebhookResultStatus.Error);
        (await redis.KeyExistsAsync($"webhook:idempotency:mp:{resourceId}:payment.updated")).Should().BeFalse();

        // 2a chamada (retry do Mercado Pago): agora deve publicar com sucesso
        var second = await webhookService.ProcessWebhookAsync(rawBody, null, null, xSig, "req-1");
        second.Status.Should().Be(WebhookResultStatus.Success);
        publish.PublishedMessages.Should().ContainSingle();
        var evt = publish.PublishedMessages.OfType<PaymentReceivedEvent>().Single();
        evt.ResourceId.Should().Be(resourceId);
    }

    // =========================================================================
    // LOG-03 & LOG-04: PaymentProcessingConsumer idempotente + TENANT_ADMIN + TenantId scope
    // =========================================================================

    [Fact]
    public async Task PaymentProcessingConsumer_CreditsOnce_PromotesTenantScopedAdmin_AndGuardsEmptyTenantActivity()
    {
        var victimTenantId = Guid.NewGuid();
        var buyerTenantId = Guid.NewGuid();
        var planId = Guid.NewGuid();
        var sharedEmail = "lojista@empresa.com";

        var userRepo = new InMemoryUserRepository();
        var victimUser = await userRepo.CreateAsync(new User { TenantId = victimTenantId, Email = sharedEmail, Role = "MEMBER", IsActive = true });
        var buyerUser = await userRepo.CreateAsync(new User { TenantId = buyerTenantId, Email = sharedEmail, Role = "MEMBER", IsActive = true });

        var tenantRepo = new InMemoryTenantRepository(userRepo);
        tenantRepo.Tenants[victimTenantId] = new Tenant { Id = victimTenantId, Name = "Vítima", IsActive = true, CreditsBalance = 10 };
        tenantRepo.Tenants[buyerTenantId] = new Tenant { Id = buyerTenantId, Name = "Comprador", IsActive = true, CreditsBalance = 10 };

        var planRepo = new InMemoryPlanRepository();
        planRepo.Plans[planId] = new Plan { Id = planId, Name = "Pro", Price = 149m, CreditsIncluded = 500, IsActive = true };

        var orderRepo = new InMemoryOrderRepository();
        var order = await orderRepo.CreateOrderAsync(new Order
        {
            Id = Guid.NewGuid(),
            TenantId = buyerTenantId,
            UserId = buyerUser.Id,
            PlanId = planId,
            ExternalReference = "rec_buyer_001",
            TotalAmount = 149m,
            Status = "pending",
            PayerEmail = sharedEmail
        });

        var mpGateway = new FakeMercadoPagoGateway
        {
            OrderResponse = new MercadoPagoOrderResponse
            {
                Id = "mp_order_1",
                ExternalReference = "rec_buyer_001",
                Status = "processed",
                StatusDetail = "accredited",
                TotalPaidAmount = 149m
            }
        };

        var redis = new InMemoryRedisService();
        var publish = new FakePublishEndpoint();
        var activityRepo = new RecordingRobotActivityRepository();
        var consumer = new PaymentProcessingConsumer(
            orderRepo,
            tenantRepo,
            planRepo,
            mpGateway,
            redis,
            publish,
            activityRepo,
            NullLogger<PaymentProcessingConsumer>.Instance,
            userRepo);

        var approvedPayload = new PaymentReceivedEvent
        {
            ResourceId = "mp_pay_1",
            Action = "payment.updated",
            RawPayload = "{}"
        };

        // Consome duas vezes (ex: payment.created + payment.updated / redelivery)
        await consumer.Consume(CreateConsumeContext(approvedPayload));
        await consumer.Consume(CreateConsumeContext(approvedPayload));

        tenantRepo.Tenants[buyerTenantId].CreditsBalance.Should().Be(510);
        tenantRepo.Transactions.Count(t => t.TenantId == buyerTenantId && t.Type == "RECHARGE").Should().Be(1);
        publish.PublishedMessages.Should().ContainSingle(); // Email enviado 1 única vez

        // Usuário promovido exclusivamente no tenant comprador para TENANT_ADMIN
        (await userRepo.GetByIdAsync(buyerUser.Id))!.Role.Should().Be("TENANT_ADMIN");
        (await userRepo.GetByIdAsync(victimUser.Id))!.Role.Should().Be("MEMBER");

        // Webhook de estorno/reembolso reverte 500 créditos uma única vez
        mpGateway.OrderResponse = new MercadoPagoOrderResponse
        {
            Id = "mp_order_1",
            ExternalReference = "rec_buyer_001",
            Status = "refunded",
            TotalPaidAmount = 149m
        };
        var refundPayload = new PaymentReceivedEvent { ResourceId = "mp_pay_1", Action = "payment.updated", RawPayload = "{}" };
        await consumer.Consume(CreateConsumeContext(refundPayload));
        await consumer.Consume(CreateConsumeContext(refundPayload));

        tenantRepo.Tenants[buyerTenantId].CreditsBalance.Should().Be(10);

        // Pedido não localizado (tenantId = Guid.Empty) não pode gravar RobotActivity
        var countBeforeUnknown = activityRepo.Activities.Count;
        mpGateway.OrderResponse = new MercadoPagoOrderResponse { Id = "unknown", ExternalReference = "ref-inexistente", Status = "approved" };
        await consumer.Consume(CreateConsumeContext(new PaymentReceivedEvent { ResourceId = "mp_unknown", Action = "payment.created", RawPayload = "{}" }));
        activityRepo.Activities.Count.Should().Be(countBeforeUnknown);
    }

    // =========================================================================
    // LOG-05: BYOK usa chave descriptografada do tenant e falha fechado sem estorno grátis
    // =========================================================================

    [Fact]
    public async Task OpenRouterGateway_UsesTenantByokKey_AndFailsClosedWhenMissingOrCorrupted()
    {
        var tenantId = Guid.NewGuid();
        var credRepo = new InMemoryTenantAiCredentialRepository();
        var crypto = new FakeAesGcmCryptoService();
        var fakeClient = new RecordingOpenRouterClient();

        await credRepo.UpsertAsync(new TenantAiCredential
        {
            TenantId = tenantId,
            Provider = "OPENROUTER",
            EncryptedApiKey = crypto.Encrypt("sk-or-v1-tenant-byok-secret").CipherText,
            InitializationVector = [1, 2, 3],
            AuthTag = [4, 5, 6],
            IsActive = true
        });

        var gateway = new OpenRouterGateway(
            fakeClient,
            new SimplePromptService(),
            new LlmContentParserService(NullLogger<LlmContentParserService>.Instance),
            Options.Create(new OpenRouterOptions { ApiKey = "sk-or-platform-global-secret", DefaultModel = "deepseek/deepseek-chat" }),
            NullLogger<OpenRouterGateway>.Instance,
            credRepo,
            crypto);

        var okResult = await gateway.EnrichProductAsync(new ProductEnrichmentLlmRequest
        {
            TenantId = tenantId,
            Sku = "SKU-BYOK-1",
            RawTitle = "Produto Teste",
            UseTenantByok = true
        });

        okResult.IsFallback.Should().BeFalse();
        fakeClient.CapturedApiKeys.Should().ContainSingle().Which.Should().Be("sk-or-v1-tenant-byok-secret");

        // Desativa chave do tenant: BYOK deve falhar fechado sem usar chave global
        var otherTenant = Guid.NewGuid();
        fakeClient.CapturedApiKeys.Clear();
        var failClosedResult = await gateway.EnrichProductAsync(new ProductEnrichmentLlmRequest
        {
            TenantId = otherTenant,
            Sku = "SKU-BYOK-MISSING",
            RawTitle = "Produto Sem Chave",
            UseTenantByok = true
        });

        failClosedResult.IsFallback.Should().BeTrue();
        failClosedResult.ErrorMessage.Should().Contain("BYOK");
        fakeClient.CapturedApiKeys.Should().BeEmpty();
    }

    [Fact]
    public async Task ScrapedProductConsumer_WhenIsByokTrue_NeverRefundsFreeCreditsOnFailure()
    {
        var tenantId = Guid.NewGuid();
        var userRepo = new InMemoryUserRepository();
        var tenantRepo = new InMemoryTenantRepository(userRepo);
        tenantRepo.Tenants[tenantId] = new Tenant { Id = tenantId, Name = "BYOK Loja", IsActive = true, CreditsBalance = 0 };

        var productRepo = new RecordingProductRepository();
        var meteringRepo = new RecordingMeteringRepository();

        var consumer = new ScrapedProductConsumer(
            new FakeFailingOpenRouterGateway(),
            productRepo,
            tenantRepo,
            meteringRepo,
            new EmptySeoGuidelineRepository(),
            new InMemoryRedisService(),
            NullLogger<ScrapedProductConsumer>.Instance);

        // Falha com IsByok=true não pode criar créditos gratuitos
        await consumer.Consume(CreateConsumeContext(new ScrapedRawProductEvent
        {
            TenantId = tenantId,
            Sku = "SKU-FREE-EXPLOIT",
            IsByok = true,
            Success = false,
            ErrorMessage = "Falha simulada BYOK"
        }));

        tenantRepo.Transactions.Where(t => t.Type == "REFUND").Should().BeEmpty();
        productRepo.StatusUpdates.Should().Contain(u => u.Sku == "SKU-FREE-EXPLOIT" && u.Status == "FAILED");

        // Falha com IsByok=false deve estornar +1 crédito normalmente
        await consumer.Consume(CreateConsumeContext(new ScrapedRawProductEvent
        {
            TenantId = tenantId,
            Sku = "SKU-PAID-1",
            IsByok = false,
            Success = false,
            ErrorMessage = "Falha no scraping pago"
        }));

        tenantRepo.Transactions.Should().ContainSingle(t => t.Type == "REFUND" && t.ReferenceId == "SKU-PAID-1" && t.Amount == 1);
    }

    [Fact]
    public async Task ScrapedProductConsumer_WhenDemoSuccess_PublishesToDemoProgressWithoutDbPersistence()
    {
        var userRepo = new InMemoryUserRepository();
        var tenantRepo = new InMemoryTenantRepository(userRepo);
        var productRepo = new RecordingProductRepository();
        var meteringRepo = new RecordingMeteringRepository();
        var redis = new InMemoryRedisService();

        var consumer = new ScrapedProductConsumer(
            new FakeSuccessOpenRouterGateway(),
            productRepo,
            tenantRepo,
            meteringRepo,
            new EmptySeoGuidelineRepository(),
            redis,
            NullLogger<ScrapedProductConsumer>.Instance);

        await consumer.Consume(CreateConsumeContext(new ScrapedRawProductEvent
        {
            TenantId = Guid.Empty,
            Sku = "demo_abc123",
            Url = "https://example.com/produto-demo",
            RawTitle = "Camiseta Básica",
            RawMarkdown = "Descrição original",
            Price = 99.90m,
            PromptContext = "demo",
            IsByok = false,
            Success = true
        }));

        redis.PublishedMessages.Should().ContainSingle(m => m.Channel == "demo_progress");
        var published = redis.PublishedMessages.Single(m => m.Channel == "demo_progress");
        using var doc = JsonDocument.Parse(published.Message);
        doc.RootElement.GetProperty("status").GetString().Should().Be("PROCESSED");
        doc.RootElement.GetProperty("url").GetString().Should().Be("https://example.com/produto-demo");
        doc.RootElement.GetProperty("result").GetProperty("titleMagnetic").GetString().Should().Be("Título Magnético Demo");

        productRepo.AddedProductsCount.Should().Be(0);
        meteringRepo.CreatedLogsCount.Should().Be(0);
        tenantRepo.Transactions.Should().BeEmpty();
    }

    [Fact]
    public async Task ScrapedProductConsumer_WhenDemoFails_PublishesFailureToDemoProgressWithoutRefundOrDbWrite()
    {
        var userRepo = new InMemoryUserRepository();
        var tenantRepo = new InMemoryTenantRepository(userRepo);
        var productRepo = new RecordingProductRepository();
        var meteringRepo = new RecordingMeteringRepository();
        var redis = new InMemoryRedisService();

        var consumer = new ScrapedProductConsumer(
            new FakeFailingOpenRouterGateway(),
            productRepo,
            tenantRepo,
            meteringRepo,
            new EmptySeoGuidelineRepository(),
            redis,
            NullLogger<ScrapedProductConsumer>.Instance);

        await consumer.Consume(CreateConsumeContext(new ScrapedRawProductEvent
        {
            TenantId = Guid.Empty,
            Sku = "demo_fail_1",
            Url = "https://example.com/inexistente",
            PromptContext = "demo",
            IsByok = false,
            Success = false,
            ErrorMessage = "Falha simulada no scraping demo"
        }));

        redis.PublishedMessages.Should().ContainSingle(m => m.Channel == "demo_progress");
        var published = redis.PublishedMessages.Single(m => m.Channel == "demo_progress");
        published.Message.Should().Contain("\"status\":\"FAILED\"");
        published.Message.Should().Contain("Falha simulada no scraping demo");

        productRepo.StatusUpdates.Should().BeEmpty();
        productRepo.AddedProductsCount.Should().Be(0);
        meteringRepo.CreatedLogsCount.Should().Be(0);
        tenantRepo.Transactions.Should().BeEmpty();
    }

    // =========================================================================
    // LOG-07: ProcessDemoRequestAsync (SSRF + exchange:demo_ecommerce) & ExportData async
    // =========================================================================

    [Fact]
    public async Task SystemService_ProcessDemoRequest_And_ExportDataToStreamAsync_WorkSafely()
    {
        var sendProvider = new RecordingSendEndpointProvider();
        var productsTable = new DataTable();
        productsTable.Columns.Add("Sku", typeof(string));
        productsTable.Columns.Add("Title", typeof(string));
        productsTable.Columns.Add("Price", typeof(decimal));
        productsTable.Columns.Add("OriginalPrice", typeof(decimal));
        productsTable.Columns.Add("Status", typeof(string));
        productsTable.Columns.Add("Category", typeof(string));
        productsTable.Columns.Add("Brand", typeof(string));
        productsTable.Columns.Add("StockQuantity", typeof(int));
        productsTable.Columns.Add("EnrichmentMetadata", typeof(string));
        productsTable.Rows.Add(
            "=cmd|calc",
            "Tênis Runner",
            199.90m,
            249.90m,
            "ENRICHED",
            "Calçados",
            "Acme",
            12,
            """{"seoKeywords":["tenis","corrida"]}""");

        var dbFactory = new FakeTabularDbConnectionFactory(_ => productsTable.CreateDataReader());
        var mux = DispatchProxy.Create<IConnectionMultiplexer, NoopMultiplexerProxy>();

        var systemService = new SystemService(
            new FakeProductRepository(),
            new RecordingRobotActivityRepository(),
            dbFactory,
            mux,
            NullLogger<SystemService>.Instance,
            sendProvider);

        // 1. Demo SSRF bloqueado
        var ssrfAct = () => systemService.ProcessDemoRequestAsync(["http://127.0.0.1/secret"]);
        await ssrfAct.Should().ThrowAsync<ArgumentException>();

        // 2. Demo pública válida envia para exchange:demo_ecommerce
        await systemService.ProcessDemoRequestAsync(["https://93.184.216.34/p1"]);
        sendProvider.SentMessages.Should().ContainSingle(m => m.Address.ToString() == "exchange:demo_ecommerce");

        // 3. Export CSV assíncrono em stream que proíbe IO síncrono (como Kestrel Response.Body)
        await using var asyncOnlyStream = new AsyncOnlyStream();
        await systemService.ExportDataToStreamAsync(Guid.NewGuid(), "shopify", asyncOnlyStream);

        var csvText = Encoding.UTF8.GetString(asyncOnlyStream.ToArray());
        csvText.Should().Contain("SKU,Title,Price,OriginalPrice,Status,Category,Brand,StockQuantity,SeoKeywords");
        csvText.Should().Contain("'=cmd|calc"); // Neutralização CSV Injection
        csvText.Should().Contain("tenis, corrida");
    }

    // =========================================================================
    // LOG-07: MachineLearningService sem clientes fictícios quando < 5 pedidos reais
    // =========================================================================

    [Fact]
    public async Task MachineLearningService_WhenLessThanFiveOrders_ReturnsInsufficientData_WithoutCooldownOrPublish()
    {
        var tenantId = Guid.NewGuid();
        var ordersTable = new DataTable();
        ordersTable.Columns.Add("CustomerId", typeof(string));
        ordersTable.Columns.Add("Amount", typeof(decimal));
        ordersTable.Columns.Add("Date", typeof(DateTimeOffset));
        // Apenas 2 pedidos qualificados (< 5)
        ordersTable.Rows.Add("real1@loja.com", 100m, DateTimeOffset.UtcNow.AddDays(-2));
        ordersTable.Rows.Add("real2@loja.com", 150m, DateTimeOffset.UtcNow.AddDays(-1));

        var emptyActivitiesTable = new DataTable();
        emptyActivitiesTable.Columns.Add("Id", typeof(Guid));
        emptyActivitiesTable.Columns.Add("TenantId", typeof(Guid));
        emptyActivitiesTable.Columns.Add("WorkerType", typeof(string));
        emptyActivitiesTable.Columns.Add("Status", typeof(string));
        emptyActivitiesTable.Columns.Add("DetailsJson", typeof(string));
        emptyActivitiesTable.Columns.Add("CreatedAt", typeof(DateTimeOffset));

        var dbFactory = new FakeTabularDbConnectionFactory(sql =>
            sql.Contains("RobotActivities", StringComparison.OrdinalIgnoreCase)
                ? emptyActivitiesTable.CreateDataReader()
                : ordersTable.CreateDataReader());
        var tenantRepo = new InMemoryTenantRepository();
        tenantRepo.Tenants[tenantId] = new Tenant { Id = tenantId, Name = "Loja ML", IsActive = true, CreditsBalance = 10 };
        var redis = new InMemoryRedisService();
        var publish = new FakePublishEndpoint();

        var mlService = new MachineLearningService(
            publish,
            dbFactory,
            new RecordingRobotActivityRepository(),
            tenantRepo,
            redis,
            NullLogger<MachineLearningService>.Instance);

        var triggered = await mlService.TriggerAnalysisAsync(tenantId);
        triggered.Should().BeFalse();
        publish.PublishedMessages.Should().BeEmpty();
        (await redis.KeyExistsAsync($"cooldown:ml:{tenantId}")).Should().BeFalse();

        // GetLatestInsightsAsync sem RobotActivity existente deve retornar INSUFFICIENT_DATA em vez de massa falsa
        var emptyInsights = await mlService.GetLatestInsightsAsync(tenantId);
        emptyInsights.Should().NotBeNull();
        emptyInsights!.Status.Should().Be("INSUFFICIENT_DATA");
    }

    // =========================================================================
    // Helpers & Test Doubles locais do Bloco 2
    // =========================================================================

    private static string ComputeMpSignature(string dataId, string xRequestId, string secret)
    {
        const string ts = "1700000000";
        var idPart = string.IsNullOrEmpty(dataId) ? string.Empty : $"id:{dataId.ToLowerInvariant()};";
        var manifest = $"{idPart}request-id:{xRequestId};ts:{ts};";
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = Convert.ToHexStringLower(hmac.ComputeHash(Encoding.UTF8.GetBytes(manifest)));
        return $"ts={ts},v1={hash}";
    }

    private static ConsumeContext<T> CreateConsumeContext<T>(T message) where T : class
    {
        var proxy = DispatchProxy.Create<ConsumeContext<T>, StaticConsumeContextProxy<T>>();
        ((StaticConsumeContextProxy<T>)(object)proxy).Message = message;
        return proxy;
    }

    public class StaticConsumeContextProxy<T> : DispatchProxy where T : class
    {
        public T Message { get; set; } = default!;

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            return targetMethod?.Name switch
            {
                "get_Message" => Message,
                "get_CancellationToken" => CancellationToken.None,
                _ => null
            };
        }
    }

    private sealed class RecordingSendEndpointProvider : ISendEndpointProvider
    {
        public List<(Uri Address, object Message)> SentMessages { get; } = new();
        public Exception? ThrowOnSend { get; set; }

        public ConnectHandle ConnectSendObserver(ISendObserver observer) => throw new NotImplementedException();

        public Task<ISendEndpoint> GetSendEndpoint(Uri address)
        {
            var endpointProxy = DispatchProxy.Create<ISendEndpoint, RecordingSendEndpointProxy>();
            var state = (RecordingSendEndpointProxy)(object)endpointProxy;
            state.Address = address;
            state.Owner = this;
            return Task.FromResult(endpointProxy);
        }

        public class RecordingSendEndpointProxy : DispatchProxy
        {
            public Uri Address { get; set; } = default!;
            public RecordingSendEndpointProvider Owner { get; set; } = default!;

            protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
            {
                if (targetMethod?.Name == nameof(ISendEndpoint.Send) && args is { Length: > 0 } && args[0] != null)
                {
                    if (Owner.ThrowOnSend != null)
                        return Task.FromException(Owner.ThrowOnSend);

                    Owner.SentMessages.Add((Address, args[0]!));
                    return Task.CompletedTask;
                }
                return Task.CompletedTask;
            }
        }
    }

    private sealed class FlakyPublishEndpoint : IPublishEndpoint
    {
        public int FailCount { get; set; }
        public ConcurrentBag<object> PublishedMessages { get; } = new();
        private int _calls;

        public ConnectHandle ConnectPublishObserver(IPublishObserver observer) => throw new NotImplementedException();

        private Task HandlePublish(object msg)
        {
            if (Interlocked.Increment(ref _calls) <= FailCount)
                throw new InvalidOperationException("Simulated RabbitMQ outage");

            PublishedMessages.Add(msg);
            return Task.CompletedTask;
        }

        public Task Publish<T>(T message, CancellationToken cancellationToken = default) where T : class => HandlePublish(message);
        public Task Publish<T>(T message, IPipe<PublishContext<T>> publishPipe, CancellationToken cancellationToken = default) where T : class => HandlePublish(message);
        public Task Publish<T>(T message, IPipe<PublishContext> publishPipe, CancellationToken cancellationToken = default) where T : class => HandlePublish(message);
        public Task Publish(object message, CancellationToken cancellationToken = default) => HandlePublish(message);
        public Task Publish(object message, IPipe<PublishContext> publishPipe, CancellationToken cancellationToken = default) => HandlePublish(message);
        public Task Publish(object message, Type messageType, CancellationToken cancellationToken = default) => HandlePublish(message);
        public Task Publish(object message, Type messageType, IPipe<PublishContext> publishPipe, CancellationToken cancellationToken = default) => HandlePublish(message);
        public Task Publish<T>(object values, CancellationToken cancellationToken = default) where T : class => Task.CompletedTask;
        public Task Publish<T>(object values, IPipe<PublishContext<T>> publishPipe, CancellationToken cancellationToken = default) where T : class => Task.CompletedTask;
        public Task Publish<T>(object values, IPipe<PublishContext> publishPipe, CancellationToken cancellationToken = default) where T : class => Task.CompletedTask;
    }

    private sealed class InMemoryTenantAiCredentialRepository : ITenantAiCredentialRepository
    {
        private readonly List<TenantAiCredential> _items = new();

        public Task<TenantAiCredential?> GetByProviderAsync(Guid tenantId, string provider, CancellationToken cancellationToken = default)
            => Task.FromResult(_items.FirstOrDefault(x => x.TenantId == tenantId && string.Equals(x.Provider, provider, StringComparison.OrdinalIgnoreCase) && x.IsActive));

        public Task<bool> HasActiveByokAsync(Guid tenantId, CancellationToken cancellationToken = default)
            => Task.FromResult(_items.Any(x => x.TenantId == tenantId && string.Equals(x.Provider, "OPENROUTER", StringComparison.OrdinalIgnoreCase) && x.IsActive));

        public Task UpsertAsync(TenantAiCredential credential, CancellationToken cancellationToken = default)
        {
            _items.RemoveAll(x => x.TenantId == credential.TenantId && string.Equals(x.Provider, credential.Provider, StringComparison.OrdinalIgnoreCase));
            _items.Add(credential);
            return Task.CompletedTask;
        }
    }

    private sealed class InMemoryPlanRepository : IPlanRepository
    {
        public ConcurrentDictionary<Guid, Plan> Plans { get; } = new();
        public Task<Plan?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult(Plans.TryGetValue(id, out var p) ? p : null);
        public Task<IEnumerable<Plan>> GetAllAsync(bool onlyActive = false, CancellationToken cancellationToken = default) => Task.FromResult(Plans.Values.Where(p => !onlyActive || p.IsActive));
        public Task<Guid> CreateAsync(Plan plan, CancellationToken cancellationToken = default) { Plans[plan.Id] = plan; return Task.FromResult(plan.Id); }
        public Task UpdateAsync(Plan plan, CancellationToken cancellationToken = default) { Plans[plan.Id] = plan; return Task.CompletedTask; }
    }

    private sealed class InMemoryOrderRepository : IOrderRepository
    {
        public ConcurrentDictionary<Guid, Order> Orders { get; } = new();
        public Task<Order> CreateOrderAsync(Order order, CancellationToken cancellationToken = default)
        {
            if (order.Id == Guid.Empty) order.Id = Guid.NewGuid();
            Orders[order.Id] = order;
            return Task.FromResult(order);
        }
        public Task<Order?> GetOrderByIdAsync(Guid id, Guid tenantId, CancellationToken cancellationToken = default)
            => Task.FromResult(Orders.Values.FirstOrDefault(o => o.Id == id && o.TenantId == tenantId));
        public Task<Order?> GetOrderByExternalReferenceAsync(string externalReference, Guid tenantId, CancellationToken cancellationToken = default)
            => Task.FromResult(Orders.Values.FirstOrDefault(o => o.ExternalReference == externalReference && o.TenantId == tenantId));
        public Task<Order?> GetOrderByExternalReferenceGlobalAsync(string externalReference, CancellationToken cancellationToken = default)
            => Task.FromResult(Orders.Values.FirstOrDefault(o => o.ExternalReference == externalReference));
        public Task<Order?> GetOrderByMpPaymentIdAsync(string mpPaymentId, CancellationToken cancellationToken = default)
            => Task.FromResult(Orders.Values.FirstOrDefault(o => o.MpPaymentId == mpPaymentId));
        public Task UpdateOrderAsync(Order order, CancellationToken cancellationToken = default) { Orders[order.Id] = order; return Task.CompletedTask; }
    }

    private sealed class FakeMercadoPagoGateway : IMercadoPagoGateway
    {
        public MercadoPagoOrderResponse? OrderResponse { get; set; }
        public Task<MercadoPagoOrderResponse> CreateOrderAsync(MercadoPagoOrderRequest request, string? idempotencyKey = null, CancellationToken cancellationToken = default)
            => Task.FromResult(new MercadoPagoOrderResponse { Id = "mp_created_1", Status = "pending" });
        public Task<MercadoPagoOrderResponse?> GetOrderByIdAsync(string orderId, CancellationToken cancellationToken = default)
            => Task.FromResult(OrderResponse);
        public Task<MercadoPagoPaymentResponse?> GetPaymentByIdAsync(string paymentId, CancellationToken cancellationToken = default)
            => Task.FromResult<MercadoPagoPaymentResponse?>(null);
        public Task<bool> RefundPaymentAsync(string paymentId, decimal? amount = null, CancellationToken cancellationToken = default)
            => Task.FromResult(true);
    }

    private sealed class FakeBillingProfileRepository : ITenantBillingProfileRepository
    {
        public Task<TenantBillingProfile?> GetByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default) => Task.FromResult<TenantBillingProfile?>(null);
        public Task<TenantBillingProfile> UpsertAsync(TenantBillingProfile profile, CancellationToken cancellationToken = default) => Task.FromResult(profile);
    }

    private sealed class RecordingRobotActivityRepository : IRobotActivityRepository
    {
        public List<RobotActivity> Activities { get; } = new();
        public Task<RobotActivity> CreateAsync(RobotActivity activity, CancellationToken cancellationToken = default) { Activities.Add(activity); return Task.FromResult(activity); }
        public Task<IEnumerable<RobotActivity>> GetRecentAsync(Guid tenantId, int limit, int offset, CancellationToken cancellationToken = default) => Task.FromResult(Enumerable.Empty<RobotActivity>());
        public Task<double> GetAverageLatencyAsync(Guid tenantId, TimeSpan timeframe, CancellationToken cancellationToken = default) => Task.FromResult(0d);
    }

    private sealed class RecordingProductRepository : IProductRepository
    {
        public List<(string Sku, string Status)> StatusUpdates { get; } = new();
        public int AddedProductsCount { get; private set; }
        public Task<Product?> GetBySkuAsync(Guid tenantId, string sku, CancellationToken cancellationToken = default) => Task.FromResult<Product?>(null);
        public Task<IEnumerable<Product>> GetProductsAsync(Guid tenantId, int page, int pageSize, CancellationToken cancellationToken = default) => Task.FromResult(Enumerable.Empty<Product>());
        public Task<Guid> AddAsync(Product product, CancellationToken cancellationToken = default) { AddedProductsCount++; return Task.FromResult(Guid.NewGuid()); }
        public Task UpdateStatusAsync(Guid tenantId, string sku, string status, string? metadata = null, CancellationToken cancellationToken = default) { StatusUpdates.Add((sku, status)); return Task.CompletedTask; }
        public Task<(IEnumerable<Product> Products, int TotalCount)> GetPaginatedAsync(Guid tenantId, string? statusFilter, string? search, int page, int limit, CancellationToken cancellationToken = default) => Task.FromResult((Enumerable.Empty<Product>(), 0));
        public Task UpdateAsync(Product product, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task DeleteAsync(Guid tenantId, string sku, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class RecordingOpenRouterClient : IOpenRouterClient
    {
        public List<string> CapturedApiKeys { get; } = new();

        public Task<OpenRouterChatCompletionResponse?> CreateChatCompletionAsync(OpenRouterChatCompletionRequest request, string apiKey, CancellationToken cancellationToken = default)
        {
            CapturedApiKeys.Add(apiKey);
            return Task.FromResult<OpenRouterChatCompletionResponse?>(new OpenRouterChatCompletionResponse
            {
                Model = request.Model,
                Choices =
                [
                    new OpenRouterChoice
                    {
                        Message = new OpenRouterMessage
                        {
                            Role = "assistant",
                            Content = """{"title":"Titulo Enriquecido","description":"Descricao SEO","bullet_points":["A"],"seo_keywords":["seo"],"faqs":[]}"""
                        }
                    }
                ],
                Usage = new OpenRouterUsage { PromptTokens = 10, CompletionTokens = 20, TotalTokens = 30 }
            });
        }
    }

    private sealed class SimplePromptService : IProductEnrichmentPromptService
    {
        public OpenRouterChatCompletionRequest BuildPromptRequest(ProductEnrichmentLlmRequest request, string model)
            => new() { Model = model, Messages = [new OpenRouterMessage { Role = "user", Content = request.RawTitle }] };
    }

    private sealed class FakeFailingOpenRouterGateway : IOpenRouterGateway
    {
        public Task<ProductEnrichmentLlmResponse> EnrichProductAsync(ProductEnrichmentLlmRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(new ProductEnrichmentLlmResponse { IsFallback = true, ErrorMessage = "BYOK failed", ModelUsed = "none" });
    }

    private sealed class FakeSuccessOpenRouterGateway : IOpenRouterGateway
    {
        public Task<ProductEnrichmentLlmResponse> EnrichProductAsync(ProductEnrichmentLlmRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(new ProductEnrichmentLlmResponse
            {
                Title = "Título Magnético Demo",
                Description = "Descrição otimizada para conversão.",
                BulletPoints = ["Ponto 1", "Ponto 2"],
                SeoKeywords = ["demo", "seo"],
                ModelUsed = "test-model",
                IsFallback = false
            });
    }

    private sealed class RecordingMeteringRepository : IMeteringRepository
    {
        public int CreatedLogsCount { get; private set; }
        public Task<decimal> GetManagedCreditBalanceAsync(Guid tenantId, CancellationToken cancellationToken = default) => Task.FromResult(0m);
        public Task<LlmUsageLog> CreateUsageLogAsync(LlmUsageLog log, CancellationToken cancellationToken = default) { CreatedLogsCount++; return Task.FromResult(log); }
        public Task<bool> AtomicReserveCreditsAsync(Guid tenantId, decimal estimatedCost, CancellationToken cancellationToken = default) => Task.FromResult(true);
        public Task AtomicRefundCreditsAsync(Guid tenantId, decimal amount, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task AtomicSettleCreditsAsync(Guid tenantId, decimal reservedCost, decimal actualCost, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<(int TotalTokens, decimal TotalCost)> GetMonthlyTelemetryAsync(Guid tenantId, CancellationToken cancellationToken = default) => Task.FromResult((0, 0m));
        public Task<(IEnumerable<LlmUsageLog> Items, int TotalCount)> GetUsageLogsPaginatedAsync(Guid tenantId, int page, int limit, DateTimeOffset? startDate, DateTimeOffset? endDate, CancellationToken cancellationToken = default) => Task.FromResult((Enumerable.Empty<LlmUsageLog>(), 0));
    }

    private sealed class EmptySeoGuidelineRepository : ICategorySeoGuidelinesRepository
    {
        public Task<CategorySeoGuideline?> GetGuidelineByCategoryAsync(Guid tenantId, string? categoryName, CancellationToken cancellationToken = default)
            => Task.FromResult<CategorySeoGuideline?>(null);
    }

    public class NoopMultiplexerProxy : DispatchProxy
    {
        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args) => null;
    }

    private sealed class AsyncOnlyStream : Stream
    {
        private readonly MemoryStream _inner = new();

        public byte[] ToArray() => _inner.ToArray();
        public override bool CanRead => false;
        public override bool CanSeek => false;
        public override bool CanWrite => true;
        public override long Length => _inner.Length;
        public override long Position { get => _inner.Position; set => throw new NotSupportedException(); }

        public override void Write(byte[] buffer, int offset, int count)
            => throw new InvalidOperationException("Synchronous operations are disallowed.");

        public override void WriteByte(byte value)
            => throw new InvalidOperationException("Synchronous operations are disallowed.");

        public override void Flush()
            => throw new InvalidOperationException("Synchronous operations are disallowed.");

        public override Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
        {
            _inner.Write(buffer, offset, count);
            return Task.CompletedTask;
        }

        public override ValueTask WriteAsync(ReadOnlyMemory<byte> buffer, CancellationToken cancellationToken = default)
        {
            _inner.Write(buffer.Span);
            return ValueTask.CompletedTask;
        }

        public override Task FlushAsync(CancellationToken cancellationToken) => Task.CompletedTask;
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
    }

    private sealed class FakeTabularDbConnectionFactory(Func<string, DbDataReader> readerFactory) : IDbConnectionFactory
    {
        public Task<IDbConnection> CreateConnectionAsync(CancellationToken cancellationToken = default) => Task.FromResult<IDbConnection>(new FakeTabularDbConnection(readerFactory));
        public Task<IDbConnection> CreateConnectionAsync(Guid? tenantId, CancellationToken cancellationToken = default) => Task.FromResult<IDbConnection>(new FakeTabularDbConnection(readerFactory));
        public Task<IDbConnection> CreateSystemConnectionAsync(CancellationToken cancellationToken = default) => Task.FromResult<IDbConnection>(new FakeTabularDbConnection(readerFactory));
    }

    private sealed class FakeTabularDbConnection(Func<string, DbDataReader> readerFactory) : DbConnection
    {
        private string _connStr = string.Empty;
        [System.Diagnostics.CodeAnalysis.AllowNull]
        public override string ConnectionString { get => _connStr; set => _connStr = value ?? string.Empty; }
        public override string Database => "Fake";
        public override string DataSource => "Fake";
        public override string ServerVersion => "1.0";
        public override ConnectionState State => ConnectionState.Open;
        public override void ChangeDatabase(string databaseName) { }
        public override void Close() { }
        public override void Open() { }
        protected override DbTransaction BeginDbTransaction(IsolationLevel isolationLevel) => throw new NotImplementedException();
        protected override DbCommand CreateDbCommand() => new FakeTabularDbCommand(readerFactory, this);
    }

    private sealed class FakeTabularDbCommand(Func<string, DbDataReader> readerFactory, DbConnection conn) : DbCommand
    {
        private readonly FakeParamCollection _params = new();
        [System.Diagnostics.CodeAnalysis.AllowNull]
        public override string CommandText { get; set; } = string.Empty;
        public override int CommandTimeout { get; set; } = 30;
        public override CommandType CommandType { get; set; } = CommandType.Text;
        public override bool DesignTimeVisible { get; set; }
        public override UpdateRowSource UpdatedRowSource { get; set; }
        protected override DbConnection? DbConnection { get => conn; set { } }
        protected override DbParameterCollection DbParameterCollection => _params;
        protected override DbTransaction? DbTransaction { get; set; }
        public override void Cancel() { }
        public override int ExecuteNonQuery() => 0;
        public override object? ExecuteScalar() => null;
        public override void Prepare() { }
        protected override DbParameter CreateDbParameter() => new FakeDbParameter();
        protected override DbDataReader ExecuteDbDataReader(CommandBehavior behavior) => readerFactory(CommandText);
    }

    private sealed class FakeDbParameter : DbParameter
    {
        public override DbType DbType { get; set; }
        public override ParameterDirection Direction { get; set; }
        public override bool IsNullable { get; set; }
        [System.Diagnostics.CodeAnalysis.AllowNull]
        public override string ParameterName { get; set; } = string.Empty;
        public override int Size { get; set; }
        [System.Diagnostics.CodeAnalysis.AllowNull]
        public override string SourceColumn { get; set; } = string.Empty;
        public override bool SourceColumnNullMapping { get; set; }
        public override object? Value { get; set; }
        public override void ResetDbType() { }
    }

    private sealed class FakeParamCollection : DbParameterCollection
    {
        private readonly List<object> _items = new();
        public override int Count => _items.Count;
        public override object SyncRoot => this;
        public override int Add(object value) { _items.Add(value); return _items.Count - 1; }
        public override void AddRange(Array values) { foreach (var v in values) _items.Add(v!); }
        public override void Clear() => _items.Clear();
        public override bool Contains(object value) => _items.Contains(value);
        public override bool Contains(string value) => false;
        public override void CopyTo(Array array, int index) { }
        public override System.Collections.IEnumerator GetEnumerator() => _items.GetEnumerator();
        public override int IndexOf(object value) => _items.IndexOf(value);
        public override int IndexOf(string parameterName) => -1;
        public override void Insert(int index, object value) => _items.Insert(index, value);
        public override void Remove(object value) => _items.Remove(value);
        public override void RemoveAt(int index) => _items.RemoveAt(index);
        public override void RemoveAt(string parameterName) { }
        protected override DbParameter GetParameter(int index) => (DbParameter)_items[index];
        protected override DbParameter GetParameter(string parameterName) => throw new NotSupportedException();
        protected override void SetParameter(int index, DbParameter value) => _items[index] = value;
        protected override void SetParameter(string parameterName, DbParameter value) { }
    }
}
