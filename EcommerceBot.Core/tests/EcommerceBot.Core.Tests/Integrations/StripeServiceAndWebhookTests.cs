using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Api.Controllers;
using EcommerceBot.Application.DTOs.Messaging;
using EcommerceBot.Application.DTOs.Stripe;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Core.Tests.Security;
using EcommerceBot.Infrastructure.Options;
using EcommerceBot.Infrastructure.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace EcommerceBot.Core.Tests.Integrations;

public sealed class StripeServiceAndWebhookTests
{
    private const string WebhookSecret = "whsec_test_secret_stripe_automated_testing_123";

    // =========================================================================
    // 1. StripeOptions Fail-Closed Validation (INV-3)
    // =========================================================================

    [Fact]
    public void StripeOptions_Validate_ThrowsWhenSecretKeyMissing()
    {
        var options = new StripeOptions
        {
            SecretKey = string.Empty,
            PublishableKey = "pk_test_123"
        };

        var act = () => options.Validate();
        act.Should().Throw<InvalidOperationException>().WithMessage("*Stripe:SecretKey*");
    }

    [Fact]
    public void StripeOptions_Validate_ThrowsWhenPublishableKeyMissing()
    {
        var options = new StripeOptions
        {
            SecretKey = "sk_test_123",
            PublishableKey = string.Empty
        };

        var act = () => options.Validate();
        act.Should().Throw<InvalidOperationException>().WithMessage("*Stripe:PublishableKey*");
    }

    [Fact]
    public void StripeOptions_Validate_PassesWhenKeysPresent()
    {
        var options = new StripeOptions
        {
            SecretKey = "sk_test_123",
            PublishableKey = "pk_test_123"
        };

        var act = () => options.Validate();
        act.Should().NotThrow();
    }

    // =========================================================================
    // 2. StripeWebhookService HMAC & Idempotência (72h)
    // =========================================================================

    [Fact]
    public async Task StripeWebhookService_RejectsMissingSecret()
    {
        var redis = new InMemoryRedisService();
        var publish = new FakePublishEndpoint();
        var service = new StripeWebhookService(
            redis,
            publish,
            Options.Create(new StripeOptions { WebhookSecret = string.Empty }),
            NullLogger<StripeWebhookService>.Instance);

        var result = await service.ProcessWebhookAsync("{}", "t=1,v1=abc");
        result.Status.Should().Be(StripeWebhookResultStatus.MissingSecret);
    }

    [Fact]
    public async Task StripeWebhookService_RejectsInvalidSignature()
    {
        var redis = new InMemoryRedisService();
        var publish = new FakePublishEndpoint();
        var service = new StripeWebhookService(
            redis,
            publish,
            Options.Create(new StripeOptions { WebhookSecret = WebhookSecret, SecretKey = "sk_test_123", PublishableKey = "pk_test_123" }),
            NullLogger<StripeWebhookService>.Instance);

        var result = await service.ProcessWebhookAsync("{\"id\":\"evt_1\"}", "t=1,v1=invalid_hmac_signature");
        result.Status.Should().Be(StripeWebhookResultStatus.InvalidSignature);
    }

    [Fact]
    public async Task StripeWebhookService_ProcessesValidEvent_AndAppliesIdempotency72h()
    {
        var redis = new InMemoryRedisService();
        var publish = new FakePublishEndpoint();
        var service = new StripeWebhookService(
            redis,
            publish,
            Options.Create(new StripeOptions { WebhookSecret = WebhookSecret, SecretKey = "sk_test_123", PublishableKey = "pk_test_123" }),
            NullLogger<StripeWebhookService>.Instance);

        var eventId = "evt_stripe_test_001";
        var piId = "pi_3MtwBwLkdIwHu7ix28a3tqPa";
        var rawJson = $"{{\"id\":\"{eventId}\",\"object\":\"event\",\"type\":\"payment_intent.succeeded\",\"data\":{{\"object\":{{\"id\":\"{piId}\",\"object\":\"payment_intent\"}}}}}}";
        var signature = Stripe.EventUtility.GenerateSignatureHeader(rawJson, WebhookSecret);

        // 1a chamada: Sucesso
        var result1 = await service.ProcessWebhookAsync(rawJson, signature);
        result1.Status.Should().Be(StripeWebhookResultStatus.Success);
        result1.EventId.Should().Be(eventId);
        result1.ResourceId.Should().Be(piId);
        (await redis.KeyExistsAsync($"webhook:idempotency:stripe:{eventId}")).Should().BeTrue();

        // 2a chamada (duplicada): Idempotente
        var result2 = await service.ProcessWebhookAsync(rawJson, signature);
        result2.Status.Should().Be(StripeWebhookResultStatus.AlreadyProcessed);
        result2.EventId.Should().Be(eventId);
    }

    // =========================================================================
    // 3. StripeWebhookController HTTP Behavior
    // =========================================================================

    [Fact]
    public async Task StripeWebhookController_ReturnsOk_WhenProcessedSuccessfully()
    {
        var fakeService = new FakeWebhookService(new StripeWebhookProcessResult
        {
            Status = StripeWebhookResultStatus.Success,
            EventId = "evt_ok_123"
        });

        var controller = new StripeWebhookController(fakeService, NullLogger<StripeWebhookController>.Instance)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

        controller.HttpContext.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes("{}"));

        var response = await controller.ReceiveWebhook("t=1,v1=sig");
        response.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task StripeWebhookController_ReturnsUnauthorized_WhenSignatureInvalid()
    {
        var fakeService = new FakeWebhookService(new StripeWebhookProcessResult
        {
            Status = StripeWebhookResultStatus.InvalidSignature,
            Message = "Invalid HMAC signature"
        });

        var controller = new StripeWebhookController(fakeService, NullLogger<StripeWebhookController>.Instance)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

        controller.HttpContext.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes("{}"));

        var response = await controller.ReceiveWebhook("t=1,v1=bad_sig");
        response.Should().BeOfType<ObjectResult>();
        var objResult = (ObjectResult)response;
        objResult.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
    }

    // =========================================================================
    // Test Doubles
    // =========================================================================

    private sealed class FakeWebhookService : IStripeWebhookService
    {
        private readonly StripeWebhookProcessResult _result;

        public FakeWebhookService(StripeWebhookProcessResult result)
        {
            _result = result;
        }

        public Task<StripeWebhookProcessResult> ProcessWebhookAsync(string rawPayload, string? stripeSignatureHeader, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(_result);
        }
    }
}
