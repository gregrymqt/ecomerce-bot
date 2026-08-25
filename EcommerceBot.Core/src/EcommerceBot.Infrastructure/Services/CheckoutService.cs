using System;
using System.Linq;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Checkout;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services
{
    public class CheckoutService : ICheckoutService
    {
        private readonly IOrderRepository _orderRepository;
        private readonly ILogger<CheckoutService> _logger;

        public CheckoutService(IOrderRepository orderRepository, ILogger<CheckoutService> logger)
        {
            _orderRepository = orderRepository;
            _logger = logger;
        }

        public async Task<CheckoutResponse> CreateOrderAsync(Guid tenantId, CreateCheckoutRequest request)
        {
            var totalAmount = request.Items.Sum(i => i.UnitPrice * i.Quantity);

            var order = new Order
            {
                TenantId = tenantId,
                ExternalReference = request.ExternalReference,
                PayerEmail = request.PayerEmail,
                PayerDocumentType = request.PayerDocumentType,
                PayerDocumentNumber = request.PayerDocumentNumber,
                PaymentMethod = request.PaymentMethod,
                TotalAmount = totalAmount,
                Status = "pending",
                Items = request.Items.Select(i => new OrderItem
                {
                    Title = i.Title,
                    UnitPrice = i.UnitPrice,
                    Quantity = i.Quantity,
                    ExternalCode = i.ExternalCode
                }).ToList()
            };

            // SIMULAÇÃO: Integração com Mercado Pago
            // Aqui haveria uma injeção de IMercadoPagoGateway chamando POST /v1/payments ou /v1/orders
            _logger.LogInformation("Simulating Mercado Pago integration for tenant {TenantId} amount {Amount}", tenantId, totalAmount);
            
            if (request.PaymentMethod.ToLower() == "pix")
            {
                order.PixQrCode = "00020101021243650016BR.GOV.BCB.PIX... (mock)";
                order.PixQrCodeBase64 = "iVBORw0KGgoAAAANSUhEUgAA... (mock)";
                order.PixExpirationDate = DateTimeOffset.UtcNow.AddMinutes(30);
            }
            else if (request.PaymentMethod.ToLower() == "ticket")
            {
                order.TicketUrl = "https://www.mercadopago.com.br/sandbox/ticket/... (mock)";
            }

            order.MpPaymentId = "MP_" + Guid.NewGuid().ToString().Substring(0, 8);

            var savedOrder = await _orderRepository.CreateOrderAsync(order);

            return new CheckoutResponse
            {
                Id = savedOrder.Id,
                ExternalReference = savedOrder.ExternalReference,
                TotalAmount = savedOrder.TotalAmount,
                Status = savedOrder.Status,
                PaymentMethod = savedOrder.PaymentMethod,
                PixQrCode = savedOrder.PixQrCode,
                PixQrCodeBase64 = savedOrder.PixQrCodeBase64,
                TicketUrl = savedOrder.TicketUrl,
                CreatedAt = savedOrder.CreatedAt
            };
        }

        public async Task<CheckoutResponse?> GetOrderAsync(Guid id, Guid tenantId)
        {
            var order = await _orderRepository.GetOrderByIdAsync(id, tenantId);
            if (order == null) return null;

            return new CheckoutResponse
            {
                Id = order.Id,
                ExternalReference = order.ExternalReference ?? string.Empty,
                TotalAmount = order.TotalAmount,
                Status = order.Status,
                PaymentMethod = order.PaymentMethod,
                PixQrCode = order.PixQrCode,
                PixQrCodeBase64 = order.PixQrCodeBase64,
                TicketUrl = order.TicketUrl,
                CreatedAt = order.CreatedAt
            };
        }
    }
}
