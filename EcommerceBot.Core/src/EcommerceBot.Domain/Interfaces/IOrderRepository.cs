using System;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces
{
    public interface IOrderRepository
    {
        Task<Order> CreateOrderAsync(Order order);
        Task<Order?> GetOrderByIdAsync(Guid id, Guid tenantId);
        Task<Order?> GetOrderByExternalReferenceAsync(string externalReference, Guid tenantId);
        Task UpdateOrderAsync(Order order);
    }
}
