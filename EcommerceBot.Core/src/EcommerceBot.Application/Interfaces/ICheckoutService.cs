using System;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.MercadoPago;

namespace EcommerceBot.Application.Interfaces;

public interface ICheckoutService
{
    Task<MercadoPagoOrderResponse?> GetOrderStatusAsync(string paymentOrOrderId, Guid tenantId, CancellationToken cancellationToken = default);
    Task<MercadoPagoOrderResponse> CreateOrderAsync(Guid tenantId, MercadoPagoOrderRequest request, CancellationToken cancellationToken = default);
    Task<MercadoPagoOrderResponse?> GetOrderAsync(Guid id, Guid tenantId, CancellationToken cancellationToken = default);
}
