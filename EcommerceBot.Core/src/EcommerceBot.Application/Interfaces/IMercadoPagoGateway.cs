using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.MercadoPago;

namespace EcommerceBot.Application.Interfaces;

public interface IMercadoPagoGateway
{
    Task<MercadoPagoOrderResponse> CreateOrderAsync(MercadoPagoOrderRequest request, string? idempotencyKey = null, CancellationToken cancellationToken = default);
    Task<MercadoPagoOrderResponse?> GetOrderByIdAsync(string orderId, CancellationToken cancellationToken = default);
    Task<MercadoPagoPaymentResponse?> GetPaymentByIdAsync(string paymentId, CancellationToken cancellationToken = default);
    Task<bool> RefundPaymentAsync(string paymentId, decimal? amount = null, CancellationToken cancellationToken = default);
}
