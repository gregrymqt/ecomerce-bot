using System;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

/// <summary>
/// Contrato de persistência para pedidos de assinatura, recargas de créditos e ordens de pagamento transparentes.
/// </summary>
public interface IOrderRepository
{
    Task<Order> CreateOrderAsync(Order order, CancellationToken cancellationToken = default);
    Task<Order?> GetOrderByIdAsync(Guid id, Guid tenantId, CancellationToken cancellationToken = default);
    Task<Order?> GetOrderByExternalReferenceAsync(string externalReference, Guid tenantId, CancellationToken cancellationToken = default);
    Task<Order?> GetOrderByExternalReferenceGlobalAsync(string externalReference, CancellationToken cancellationToken = default);
    Task<Order?> GetOrderByMpPaymentIdAsync(string mpPaymentId, CancellationToken cancellationToken = default);
    Task UpdateOrderAsync(Order order, CancellationToken cancellationToken = default);
}
