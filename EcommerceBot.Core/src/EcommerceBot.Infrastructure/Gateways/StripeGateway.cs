using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Stripe;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Infrastructure.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Stripe;
using Stripe.BillingPortal;

namespace EcommerceBot.Infrastructure.Gateways;

/// <summary>
/// Implementação do gateway Stripe para Payments, Billing, Tax e Invoicing.
/// </summary>
public sealed class StripeGateway : IStripeGateway
{
    private readonly IStripeClient _stripeClient;
    private readonly ILogger<StripeGateway> _logger;
    private readonly PaymentIntentService _paymentIntentService;
    private readonly RefundService _refundService;
    private readonly CustomerService _customerService;
    private readonly SubscriptionService _subscriptionService;
    private readonly Stripe.BillingPortal.SessionService _portalSessionService;
    private readonly InvoiceService _invoiceService;

    public StripeGateway(
        IOptions<StripeOptions> options,
        ILogger<StripeGateway> logger,
        IStripeClient? stripeClient = null)
    {
        _logger = logger;
        var stripeOptions = options.Value;
        
        _stripeClient = stripeClient ?? new StripeClient(stripeOptions.SecretKey);
        _paymentIntentService = new PaymentIntentService(_stripeClient);
        _refundService = new RefundService(_stripeClient);
        _customerService = new CustomerService(_stripeClient);
        _subscriptionService = new SubscriptionService(_stripeClient);
        _portalSessionService = new Stripe.BillingPortal.SessionService(_stripeClient);
        _invoiceService = new InvoiceService(_stripeClient);
    }

    // =========================================================================
    // PAYMENTS
    // =========================================================================

    public async Task<PaymentIntentResponse> CreatePaymentIntentAsync(
        CreatePaymentIntentRequest request,
        string? idempotencyKey = null,
        CancellationToken cancellationToken = default)
    {
        var amountInCents = (long)Math.Round(request.Amount * 100m, MidpointRounding.AwayFromZero);

        var createOptions = new PaymentIntentCreateOptions
        {
            Amount = amountInCents,
            Currency = request.Currency.ToLowerInvariant(),
            Description = request.Description,
            Customer = request.CustomerId,
            ReceiptEmail = request.CustomerEmail,
            Metadata = request.Metadata
        };

        var requestOptions = BuildRequestOptions(idempotencyKey);

        _logger.LogInformation("Creating Stripe PaymentIntent for amount: {Amount} {Currency}, Customer: {CustomerId}",
            request.Amount, request.Currency, request.CustomerId);

        var intent = await _paymentIntentService.CreateAsync(createOptions, requestOptions, cancellationToken);

        return MapPaymentIntentToResponse(intent);
    }

    public async Task<PaymentIntentResponse?> GetPaymentIntentByIdAsync(
        string paymentIntentId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var intent = await _paymentIntentService.GetAsync(paymentIntentId, null, null, cancellationToken);
            return intent is null ? null : MapPaymentIntentToResponse(intent);
        }
        catch (StripeException ex) when (ex.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
        {
            _logger.LogWarning("Stripe PaymentIntent not found: {PaymentIntentId}", paymentIntentId);
            return null;
        }
    }

    public async Task<RefundResponse> RefundAsync(
        RefundRequest request,
        string? idempotencyKey = null,
        CancellationToken cancellationToken = default)
    {
        var createOptions = new RefundCreateOptions
        {
            PaymentIntent = request.PaymentIntentId,
            Reason = request.Reason
        };

        if (request.Amount.HasValue)
        {
            createOptions.Amount = (long)Math.Round(request.Amount.Value * 100m, MidpointRounding.AwayFromZero);
        }

        var requestOptions = BuildRequestOptions(idempotencyKey);

        _logger.LogInformation("Initiating Stripe Refund for PaymentIntent: {PaymentIntentId}", request.PaymentIntentId);

        var refund = await _refundService.CreateAsync(createOptions, requestOptions, cancellationToken);

        return new RefundResponse
        {
            Id = refund.Id,
            Status = refund.Status,
            Amount = refund.Amount / 100m,
            PaymentIntentId = refund.PaymentIntentId
        };
    }

    // =========================================================================
    // BILLING & CUSTOMERS
    // =========================================================================

    public async Task<CustomerResponse> CreateCustomerAsync(
        CreateCustomerRequest request,
        CancellationToken cancellationToken = default)
    {
        var createOptions = new CustomerCreateOptions
        {
            Email = request.Email,
            Name = request.Name,
            Metadata = request.Metadata
        };

        _logger.LogInformation("Creating Stripe Customer for email: {Email}", request.Email);

        var customer = await _customerService.CreateAsync(createOptions, null, cancellationToken);

        return new CustomerResponse
        {
            Id = customer.Id,
            Email = customer.Email,
            Name = customer.Name
        };
    }

    public async Task<CustomerResponse?> GetCustomerByIdAsync(
        string customerId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var customer = await _customerService.GetAsync(customerId, null, null, cancellationToken);
            return customer is null
                ? null
                : new CustomerResponse
                {
                    Id = customer.Id,
                    Email = customer.Email,
                    Name = customer.Name
                };
        }
        catch (StripeException ex) when (ex.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
        {
            _logger.LogWarning("Stripe Customer not found: {CustomerId}", customerId);
            return null;
        }
    }

    public async Task<SubscriptionResponse> CreateSubscriptionAsync(
        CreateSubscriptionRequest request,
        string? idempotencyKey = null,
        CancellationToken cancellationToken = default)
    {
        var createOptions = new SubscriptionCreateOptions
        {
            Customer = request.CustomerId,
            Items = new List<SubscriptionItemOptions>
            {
                new() { Price = request.PriceId }
            },
            PaymentBehavior = "default_incomplete",
            PaymentSettings = new SubscriptionPaymentSettingsOptions
            {
                SaveDefaultPaymentMethod = "on_subscription"
            },
            AutomaticTax = request.EnableAutomaticTax
                ? new SubscriptionAutomaticTaxOptions { Enabled = true }
                : null,
            Metadata = request.Metadata,
            Expand = new List<string> { "latest_invoice" }
        };

        var requestOptions = BuildRequestOptions(idempotencyKey);

        _logger.LogInformation("Creating Stripe Subscription for Customer: {CustomerId}, Price: {PriceId}",
            request.CustomerId, request.PriceId);

        var subscription = await _subscriptionService.CreateAsync(createOptions, requestOptions, cancellationToken);

        var clientSecret = subscription.LatestInvoice?.ConfirmationSecret?.ClientSecret;

        return new SubscriptionResponse
        {
            Id = subscription.Id,
            CustomerId = subscription.CustomerId,
            Status = subscription.Status,
            LatestInvoiceId = subscription.LatestInvoiceId,
            ClientSecret = clientSecret
        };
    }

    public async Task<SubscriptionResponse?> GetSubscriptionByIdAsync(
        string subscriptionId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var getOptions = new SubscriptionGetOptions
            {
                Expand = new List<string> { "latest_invoice" }
            };

            var subscription = await _subscriptionService.GetAsync(subscriptionId, getOptions, null, cancellationToken);
            if (subscription is null) return null;

            var clientSecret = subscription.LatestInvoice?.ConfirmationSecret?.ClientSecret;

            return new SubscriptionResponse
            {
                Id = subscription.Id,
                CustomerId = subscription.CustomerId,
                Status = subscription.Status,
                LatestInvoiceId = subscription.LatestInvoiceId,
                ClientSecret = clientSecret
            };
        }
        catch (StripeException ex) when (ex.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
        {
            _logger.LogWarning("Stripe Subscription not found: {SubscriptionId}", subscriptionId);
            return null;
        }
    }

    public async Task<BillingPortalSessionResponse> CreateBillingPortalSessionAsync(
        CreateBillingPortalSessionRequest request,
        CancellationToken cancellationToken = default)
    {
        var sessionOptions = new Stripe.BillingPortal.SessionCreateOptions
        {
            Customer = request.CustomerId,
            ReturnUrl = request.ReturnUrl
        };

        _logger.LogInformation("Creating Stripe Billing Portal session for Customer: {CustomerId}", request.CustomerId);

        var session = await _portalSessionService.CreateAsync(sessionOptions, null, cancellationToken);

        return new BillingPortalSessionResponse
        {
            Id = session.Id,
            Url = session.Url
        };
    }

    // =========================================================================
    // INVOICING
    // =========================================================================

    public async Task<InvoiceResponse?> GetInvoiceByIdAsync(
        string invoiceId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var invoice = await _invoiceService.GetAsync(invoiceId, null, null, cancellationToken);
            if (invoice is null) return null;

            var subscriptionId = invoice.Parent?.SubscriptionDetails?.SubscriptionId;

            return new InvoiceResponse
            {
                Id = invoice.Id,
                CustomerId = invoice.CustomerId,
                SubscriptionId = subscriptionId,
                PaymentIntentId = invoice.ConfirmationSecret != null ? invoice.Id : null,
                Status = invoice.Status,
                AmountDue = invoice.AmountDue / 100m,
                AmountPaid = invoice.AmountPaid / 100m,
                HostedInvoiceUrl = invoice.HostedInvoiceUrl,
                InvoicePdf = invoice.InvoicePdf
            };
        }
        catch (StripeException ex) when (ex.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
        {
            _logger.LogWarning("Stripe Invoice not found: {InvoiceId}", invoiceId);
            return null;
        }
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private static RequestOptions? BuildRequestOptions(string? idempotencyKey)
    {
        if (string.IsNullOrWhiteSpace(idempotencyKey)) return null;
        return new RequestOptions { IdempotencyKey = idempotencyKey };
    }

    private static PaymentIntentResponse MapPaymentIntentToResponse(PaymentIntent intent)
    {
        return new PaymentIntentResponse
        {
            Id = intent.Id,
            ClientSecret = intent.ClientSecret,
            Status = intent.Status,
            Amount = intent.Amount / 100m,
            Currency = intent.Currency,
            CustomerId = intent.CustomerId,
            InvoiceId = null,
            Metadata = intent.Metadata != null ? new Dictionary<string, string>(intent.Metadata) : new()
        };
    }
}
