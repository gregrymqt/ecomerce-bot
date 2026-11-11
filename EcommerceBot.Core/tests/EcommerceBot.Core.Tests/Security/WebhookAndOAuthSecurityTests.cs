using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using EcommerceBot.Api.Controllers;
using EcommerceBot.Infrastructure.Options;
using EcommerceBot.Infrastructure.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Primitives;
using Xunit;

namespace EcommerceBot.Core.Tests.Security;

public sealed class WebhookAndOAuthSecurityTests
{
    private const string ShopifySecret = "shpss_super_secret_shopify_test_key";
    private const string NuvemshopSecret = "nuvem_super_secret_test_key";

    [Fact]
    public async Task NuvemshopController_ReceiveWebhook_WithoutHmacHeader_Returns401Unauthorized()
    {
        var redis = new InMemoryRedisService();
        var integrationRepo = new FakeStoreIntegrationRepository();
        var nuvemshopService = new NuvemshopIntegrationService(
            new HttpClient(new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK))),
            integrationRepo,
            new FakeAesGcmCryptoService(),
            new FakeEcommerceGatewayFactory(),
            new FakeProductRepository(),
            redis,
            new FakePublishEndpoint(),
            Options.Create(new NuvemshopOptions { ClientId = "123", ClientSecret = NuvemshopSecret }),
            NullLogger<NuvemshopIntegrationService>.Instance);

        var controller = new NuvemshopIntegrationController(
            nuvemshopService,
            integrationRepo,
            redis,
            Options.Create(new NuvemshopOptions { ClientId = "123", ClientSecret = NuvemshopSecret }),
            Options.Create(new AppOptions { FrontendUrl = "https://app.ecommercebot.com" }),
            new FakeWebHostEnvironment { EnvironmentName = "Production" },
            NullLogger<NuvemshopIntegrationController>.Instance);

        var httpContext = new DefaultHttpContext();
        httpContext.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes("{\"store_id\":123,\"event\":\"product/updated\",\"id\":999}"));
        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };

        var result = await controller.ReceiveWebhook(
            hmacSignature: null,
            topicHeader: "product/updated",
            storeIdHeader: "123",
            eventIdHeader: "evt-1");

        var objectResult = result.Should().BeAssignableTo<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
    }

    [Fact]
    public async Task NuvemshopService_FailsClosedWithoutCredentials_AndConsumesStateSingleUse()
    {
        var redis = new InMemoryRedisService();
        var missingCredsService = new NuvemshopIntegrationService(
            new HttpClient(new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK))),
            new FakeStoreIntegrationRepository(),
            new FakeAesGcmCryptoService(),
            new FakeEcommerceGatewayFactory(),
            new FakeProductRepository(),
            redis,
            new FakePublishEndpoint(),
            Options.Create(new NuvemshopOptions()),
            NullLogger<NuvemshopIntegrationService>.Instance);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            missingCredsService.GetOAuthUrlAsync(Guid.NewGuid()));

        var validService = new NuvemshopIntegrationService(
            new HttpClient(new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK))),
            new FakeStoreIntegrationRepository(),
            new FakeAesGcmCryptoService(),
            new FakeEcommerceGatewayFactory(),
            new FakeProductRepository(),
            redis,
            new FakePublishEndpoint(),
            Options.Create(new NuvemshopOptions { ClientId = "123", ClientSecret = NuvemshopSecret }),
            NullLogger<NuvemshopIntegrationService>.Instance);

        var tenantId = Guid.NewGuid();
        var authUrl = await validService.GetOAuthUrlAsync(tenantId);
        var query = QueryHelpers.ParseQuery(new Uri(authUrl).Query);
        var state = query["state"].ToString();

        state.Should().NotBe(tenantId.ToString());
        (await validService.ConsumeOAuthStateAsync(state)).Should().Be(tenantId);
        (await validService.ConsumeOAuthStateAsync(state)).Should().BeNull();
    }

    [Fact]
    public async Task Shopify_ValidatesShopRegex_HmacSignature_AndSingleUseState()
    {
        var redis = new InMemoryRedisService();
        var integrationRepo = new FakeStoreIntegrationRepository();
        var shopifyOptions = Options.Create(new ShopifyOptions
        {
            ClientId = "shopify_client_id",
            ClientSecret = ShopifySecret,
            AppUrl = "https://api.ecommercebot.com"
        });

        var httpHandler = new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{\"access_token\":\"shpat_test_123\"}", Encoding.UTF8, "application/json")
        });

        var shopifyService = new ShopifyIntegrationService(
            integrationRepo,
            new FakeProductRepository(),
            new FakeAesGcmCryptoService(),
            new FakeEcommerceGatewayFactory(),
            redis,
            new FakePublishEndpoint(),
            new HttpClient(httpHandler),
            shopifyOptions,
            Options.Create(new AppOptions { FrontendUrl = "https://app.ecommercebot.com" }),
            NullLogger<ShopifyIntegrationService>.Instance);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            shopifyService.GetOAuthUrlAsync(Guid.NewGuid(), "evil.attacker.com/admin"));

        var tenantId = Guid.NewGuid();
        var authorizeUrl = await shopifyService.GetOAuthUrlAsync(tenantId, "https://minha-loja.myshopify.com/");
        var state = QueryHelpers.ParseQuery(new Uri(authorizeUrl).Query)["state"].ToString();

        var controller = new ShopifyIntegrationController(
            shopifyService,
            integrationRepo,
            redis,
            shopifyOptions,
            Options.Create(new AppOptions { FrontendUrl = "https://app.ecommercebot.com" }),
            new FakeWebHostEnvironment { EnvironmentName = "Production" },
            NullLogger<ShopifyIntegrationController>.Instance);

        // 1. Callback com HMAC inválido deve retornar 401
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = BuildShopifyQueryContext("auth_code_1", "minha-loja.myshopify.com", state, "deadbeef")
        };
        var invalidHmacResult = await controller.OAuthCallback("auth_code_1", "minha-loja.myshopify.com", state, "deadbeef");
        invalidHmacResult.Should().BeAssignableTo<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);

        // 2. Callback válido assinado com HMAC e state nonce redireciona para o SPA
        var validHmac = ComputeShopifyHmac(ShopifySecret, new Dictionary<string, string>
        {
            ["code"] = "auth_code_1",
            ["shop"] = "minha-loja.myshopify.com",
            ["state"] = state
        });
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = BuildShopifyQueryContext("auth_code_1", "minha-loja.myshopify.com", state, validHmac)
        };
        var successResult = await controller.OAuthCallback("auth_code_1", "minha-loja.myshopify.com", state, validHmac);
        var redirect = successResult.Should().BeOfType<RedirectResult>().Subject;
        redirect.Url.Should().Be("https://app.ecommercebot.com/integrations?oauth=success&platform=shopify");

        // 3. Replay com mesmo state nonce é rejeitado (400 BadRequest)
        var replayResult = await controller.OAuthCallback("auth_code_1", "minha-loja.myshopify.com", state, validHmac);
        replayResult.Should().BeAssignableTo<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
    }

    private static DefaultHttpContext BuildShopifyQueryContext(string code, string shop, string state, string hmac)
    {
        var context = new DefaultHttpContext();
        context.Request.Query = new QueryCollection(new Dictionary<string, StringValues>
        {
            ["code"] = code,
            ["shop"] = shop,
            ["state"] = state,
            ["hmac"] = hmac
        });
        return context;
    }

    private static string ComputeShopifyHmac(string secret, Dictionary<string, string> paramsWithoutHmac)
    {
        var canonical = string.Join("&", new SortedDictionary<string, string>(paramsWithoutHmac, StringComparer.Ordinal)
            .Select(kv => $"{kv.Key}={kv.Value}"));
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(canonical))).ToLowerInvariant();
    }
}
