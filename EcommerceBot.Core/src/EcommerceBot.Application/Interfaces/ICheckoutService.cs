using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Checkout;

namespace EcommerceBot.Application.Interfaces;

public interface ICheckoutService
{
    Task<PixPaymentResponseDto> CreatePixOrderAsync(Guid tenantId, PixPaymentRequestDto request);
    Task<CreditCardPaymentResponseDto> ProcessCreditCardOrderAsync(Guid tenantId, CreditCardPaymentRequestDto request);
    Task<OrderStatusSyncResponseDto> GetOrderStatusAsync(string paymentOrOrderId, Guid tenantId);
    Task<CheckoutResponse> CreateOrderAsync(Guid tenantId, CreateCheckoutRequest request);
    Task<CheckoutResponse?> GetOrderAsync(Guid id, Guid tenantId);
}
