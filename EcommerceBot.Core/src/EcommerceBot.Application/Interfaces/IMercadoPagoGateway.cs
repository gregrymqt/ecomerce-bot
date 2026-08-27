using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.MercadoPago;

namespace EcommerceBot.Application.Interfaces;

public interface IMercadoPagoGateway
{
    Task<MercadoPagoOrderResponse> CreateOrderAsync(MercadoPagoOrderRequest request, string? idempotencyKey = null);
    Task<MercadoPagoOrderResponse?> GetOrderByIdAsync(string orderId);
    Task<MercadoPagoPaymentResponse?> GetPaymentByIdAsync(string paymentId);
    Task<bool> RefundPaymentAsync(string paymentId, decimal? amount = null);
}
