using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Stripe;

namespace EcommerceBot.Application.Interfaces;

/// <summary>
/// Contrato do Gateway Stripe para os produtos Payments, Billing, Tax e Invoicing.
/// </summary>
public interface IStripeGateway
{
    // =========================================================================
    // PAYMENTS (PaymentIntents & Refunds)
    // =========================================================================

    Task<PaymentIntentResponse> CreatePaymentIntentAsync(
        CreatePaymentIntentRequest request,
        string? idempotencyKey = null,
        CancellationToken cancellationToken = default);

    Task<PaymentIntentResponse?> GetPaymentIntentByIdAsync(
        string paymentIntentId,
        CancellationToken cancellationToken = default);

    Task<RefundResponse> RefundAsync(
        RefundRequest request,
        string? idempotencyKey = null,
        CancellationToken cancellationToken = default);

    // =========================================================================
    // BILLING & CUSTOMERS (Subscriptions & Customer Portal)
    // =========================================================================

    Task<CustomerResponse> CreateCustomerAsync(
        CreateCustomerRequest request,
        CancellationToken cancellationToken = default);

    Task<CustomerResponse?> GetCustomerByIdAsync(
        string customerId,
        CancellationToken cancellationToken = default);

    Task<SubscriptionResponse> CreateSubscriptionAsync(
        CreateSubscriptionRequest request,
        string? idempotencyKey = null,
        CancellationToken cancellationToken = default);

    Task<SubscriptionResponse?> GetSubscriptionByIdAsync(
        string subscriptionId,
        CancellationToken cancellationToken = default);

    Task<BillingPortalSessionResponse> CreateBillingPortalSessionAsync(
        CreateBillingPortalSessionRequest request,
        CancellationToken cancellationToken = default);

    // =========================================================================
    // INVOICING
    // =========================================================================

    Task<InvoiceResponse?> GetInvoiceByIdAsync(
        string invoiceId,
        CancellationToken cancellationToken = default);
}
