using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Checkout;

namespace EcommerceBot.Application.Interfaces
{
    public interface ICheckoutService
    {
        Task<CheckoutResponse> CreateOrderAsync(Guid tenantId, CreateCheckoutRequest request);
        Task<CheckoutResponse?> GetOrderAsync(Guid id, Guid tenantId);
    }
}
