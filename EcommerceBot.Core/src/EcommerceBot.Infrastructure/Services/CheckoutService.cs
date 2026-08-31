using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Checkout;
using EcommerceBot.Application.DTOs.MercadoPago;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

public class CheckoutService : ICheckoutService
{
    private readonly IOrderRepository _orderRepository;
    private readonly IPlanRepository _planRepository;
    private readonly ISubscriptionService _subscriptionService;
    private readonly IMercadoPagoGateway _mercadoPagoGateway;
    private readonly ILogger<CheckoutService> _logger;

    public CheckoutService(
        IOrderRepository orderRepository,
        IPlanRepository planRepository,
        ISubscriptionService subscriptionService,
        IMercadoPagoGateway mercadoPagoGateway,
        ILogger<CheckoutService> logger)
    {
        _orderRepository = orderRepository;
        _planRepository = planRepository;
        _subscriptionService = subscriptionService;
        _mercadoPagoGateway = mercadoPagoGateway;
        _logger = logger;
    }

    public async Task<PixPaymentResponseDto> CreatePixOrderAsync(Guid tenantId, PixPaymentRequestDto request)
    {
        var plan = await ResolvePlanAsync(request.PlanId);
        var planPrice = plan?.Price ?? 197.00m;
        var planName = plan?.Name ?? "Plano Pro AI";
        var externalRef = $"ord_{tenantId.ToString()[..8]}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
        var payerEmail = !string.IsNullOrEmpty(request.PayerEmail) ? request.PayerEmail : "comprador@ecommercebot.local";

        var order = new Order
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PlanId = plan?.Id,
            ExternalReference = externalRef,
            TotalAmount = planPrice,
            PaymentMethod = "pix",
            Status = "pending",
            PayerEmail = payerEmail,
            PayerDocumentType = "CPF",
            PayerDocumentNumber = request.PayerDocument,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
            Items = new List<OrderItem>
            {
                new()
                {
                    Title = planName,
                    UnitPrice = planPrice,
                    Quantity = 1,
                    ExternalCode = plan?.Id.ToString() ?? "PRO_PLAN"
                }
            }
        };

        var mpRequest = new MercadoPagoOrderRequest
        {
            Type = "online",
            ProcessingMode = "automatic",
            ExternalReference = externalRef,
            TotalAmount = planPrice.ToString("F2", System.Globalization.CultureInfo.InvariantCulture),
            Description = $"{planName} - E-commerce Bot",
            Payer = new MercadoPagoPayerRequest
            {
                Email = payerEmail,
                Identification = !string.IsNullOrEmpty(request.PayerDocument) ? new MercadoPagoIdentificationRequest
                {
                    Type = "CPF",
                    Number = request.PayerDocument.Replace(".", "").Replace("-", "")
                } : null
            },
            Transactions = new MercadoPagoTransactionsRequest
            {
                Payments = new MercadoPagoPaymentRequest
                {
                    Amount = planPrice.ToString("F2", System.Globalization.CultureInfo.InvariantCulture),
                    PaymentMethod = new MercadoPagoPaymentMethodRequest
                    {
                        Id = "pix",
                        Type = "bank_transfer"
                    },
                    ExpirationTime = "PT30M"
                }
            },
            Items = new List<MercadoPagoItemRequest>
            {
                new()
                {
                    Title = planName,
                    UnitPrice = planPrice.ToString("F2", System.Globalization.CultureInfo.InvariantCulture),
                    Quantity = 1,
                    ExternalCode = plan?.Id.ToString() ?? "PRO_PLAN"
                }
            }
        };

        var mpResponse = await _mercadoPagoGateway.CreateOrderAsync(mpRequest);

        var firstPayment = mpResponse.Transactions?.Payments?.FirstOrDefault();
        order.MpPaymentId = firstPayment?.Id ?? mpResponse.Id;
        order.PixQrCode = firstPayment?.PaymentMethod?.QrCode;
        order.PixQrCodeBase64 = firstPayment?.PaymentMethod?.QrCodeBase64;
        order.PixExpirationDate = DateTimeOffset.UtcNow.AddMinutes(30);

        await _orderRepository.CreateOrderAsync(order);

        return new PixPaymentResponseDto
        {
            PaymentId = order.MpPaymentId ?? order.Id.ToString(),
            QrCodeCopyPaste = order.PixQrCode ?? string.Empty,
            QrCodeBase64 = order.PixQrCodeBase64 ?? string.Empty,
            ExpiresAt = (order.PixExpirationDate ?? DateTimeOffset.UtcNow.AddMinutes(30)).ToString("o"),
            Status = "PENDING"
        };
    }

    public async Task<CreditCardPaymentResponseDto> ProcessCreditCardOrderAsync(Guid tenantId, CreditCardPaymentRequestDto request)
    {
        var plan = await ResolvePlanAsync(request.PlanId);
        var planPrice = plan?.Price ?? 197.00m;
        var planName = plan?.Name ?? "Plano Pro AI";
        var externalRef = $"ord_{tenantId.ToString()[..8]}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
        var payerEmail = !string.IsNullOrEmpty(request.PayerEmail) ? request.PayerEmail : "comprador@ecommercebot.local";

        var order = new Order
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PlanId = plan?.Id,
            ExternalReference = externalRef,
            TotalAmount = planPrice,
            PaymentMethod = "credit_card",
            Status = "pending",
            PayerEmail = payerEmail,
            PayerDocumentType = "CPF",
            PayerDocumentNumber = request.DocNumber,
            Installments = request.Installments,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
            Items = new List<OrderItem>
            {
                new()
                {
                    Title = planName,
                    UnitPrice = planPrice,
                    Quantity = 1,
                    ExternalCode = plan?.Id.ToString() ?? "PRO_PLAN"
                }
            }
        };

        var cleanDoc = request.DocNumber?.Replace(".", "").Replace("-", "") ?? string.Empty;

        var mpRequest = new MercadoPagoOrderRequest
        {
            Type = "online",
            ProcessingMode = "automatic",
            ExternalReference = externalRef,
            TotalAmount = planPrice.ToString("F2", System.Globalization.CultureInfo.InvariantCulture),
            Description = $"{planName} - E-commerce Bot",
            Payer = new MercadoPagoPayerRequest
            {
                Email = payerEmail,
                Identification = !string.IsNullOrEmpty(cleanDoc) ? new MercadoPagoIdentificationRequest
                {
                    Type = cleanDoc.Length > 11 ? "CNPJ" : "CPF",
                    Number = cleanDoc
                } : null
            },
            Transactions = new MercadoPagoTransactionsRequest
            {
                Payments = new MercadoPagoPaymentRequest
                {
                    Amount = planPrice.ToString("F2", System.Globalization.CultureInfo.InvariantCulture),
                    PaymentMethod = new MercadoPagoPaymentMethodRequest
                    {
                        Id = request.PaymentMethodId ?? "visa",
                        Type = "credit_card",
                        Token = request.CardToken,
                        Installments = request.Installments > 0 ? request.Installments : 1,
                        StatementDescriptor = "ECOMAUTOBOT"
                    }
                }
            },
            Items = new List<MercadoPagoItemRequest>
            {
                new()
                {
                    Title = planName,
                    UnitPrice = planPrice.ToString("F2", System.Globalization.CultureInfo.InvariantCulture),
                    Quantity = 1,
                    ExternalCode = plan?.Id.ToString() ?? "PRO_PLAN"
                }
            },
            Config = new MercadoPagoConfigRequest
            {
                Online = new MercadoPagoOnlineConfigRequest
                {
                    TransactionSecurity = new MercadoPagoTransactionSecurityRequest
                    {
                        Validation = "never"
                    }
                }
            }
        };

        var mpResponse = await _mercadoPagoGateway.CreateOrderAsync(mpRequest);

        var firstPayment = mpResponse.Transactions?.Payments?.FirstOrDefault();
        order.MpPaymentId = firstPayment?.Id ?? mpResponse.Id;
        
        var isApproved = (mpResponse.Status == "processed" && mpResponse.StatusDetail == "accredited") ||
                         (firstPayment?.Status == "processed" && firstPayment?.StatusDetail == "accredited");

        if (isApproved)
        {
            order.Status = "approved";
            order.PaidAt = DateTimeOffset.UtcNow;
            order.TotalPaidAmount = planPrice;
            
            if (plan != null)
            {
                await _subscriptionService.ActivateOrRenewSubscriptionAsync(tenantId, plan.Id);
            }
        }
        else if (mpResponse.Status == "failed" || mpResponse.Status == "canceled")
        {
            order.Status = "rejected";
        }

        await _orderRepository.CreateOrderAsync(order);

        return new CreditCardPaymentResponseDto
        {
            PaymentId = order.MpPaymentId ?? order.Id.ToString(),
            Status = isApproved ? "APPROVED" : (order.Status == "rejected" ? "REJECTED" : "PENDING"),
            Message = isApproved ? "Pagamento aprovado com sucesso!" : (order.Status == "rejected" ? "Pagamento recusado pela emissora do cartão." : "Pagamento em análise.")
        };
    }

    public async Task<OrderStatusSyncResponseDto> GetOrderStatusAsync(string paymentOrOrderId, Guid tenantId)
    {
        // 1. Tenta buscar no banco de dados primeiro
        Order? order = null;
        if (Guid.TryParse(paymentOrOrderId, out var orderGuid))
        {
            order = await _orderRepository.GetOrderByIdAsync(orderGuid, tenantId);
        }

        if (order == null)
        {
            order = await _orderRepository.GetOrderByMpPaymentIdAsync(paymentOrOrderId);
            if (order != null && order.TenantId != tenantId)
            {
                order = null; // Isolamento multi-tenant
            }
        }

        if (order != null && (order.Status == "approved" || order.Status == "rejected"))
        {
            return new OrderStatusSyncResponseDto
            {
                PaymentId = paymentOrOrderId,
                Status = order.Status == "approved" ? "APPROVED" : "REJECTED",
                IsApproved = order.Status == "approved"
            };
        }

        // 2. Consulta a API do Mercado Pago se ainda estiver pending
        var mpOrder = await _mercadoPagoGateway.GetOrderByIdAsync(paymentOrOrderId);
        if (mpOrder != null)
        {
            var isAccredited = mpOrder.Status == "processed" && mpOrder.StatusDetail == "accredited";
            if (isAccredited && order != null && order.Status != "approved")
            {
                order.Status = "approved";
                order.PaidAt = DateTimeOffset.UtcNow;
                order.TotalPaidAmount = order.TotalAmount;
                await _orderRepository.UpdateOrderAsync(order);

                if (order.PlanId.HasValue)
                {
                    await _subscriptionService.ActivateOrRenewSubscriptionAsync(tenantId, order.PlanId.Value);
                }
            }

            return new OrderStatusSyncResponseDto
            {
                PaymentId = paymentOrOrderId,
                Status = isAccredited ? "APPROVED" : (mpOrder.Status == "failed" ? "REJECTED" : "PENDING"),
                IsApproved = isAccredited
            };
        }

        // Fallback para payments/{id}
        var mpPayment = await _mercadoPagoGateway.GetPaymentByIdAsync(paymentOrOrderId);
        if (mpPayment != null)
        {
            var isApproved = mpPayment.Status == "approved";
            if (isApproved && order != null && order.Status != "approved")
            {
                order.Status = "approved";
                order.PaidAt = DateTimeOffset.UtcNow;
                order.TotalPaidAmount = mpPayment.TransactionAmount ?? order.TotalAmount;
                await _orderRepository.UpdateOrderAsync(order);

                if (order.PlanId.HasValue)
                {
                    await _subscriptionService.ActivateOrRenewSubscriptionAsync(tenantId, order.PlanId.Value);
                }
            }

            return new OrderStatusSyncResponseDto
            {
                PaymentId = paymentOrOrderId,
                Status = isApproved ? "APPROVED" : "PENDING",
                IsApproved = isApproved
            };
        }

        return new OrderStatusSyncResponseDto
        {
            PaymentId = paymentOrOrderId,
            Status = "PENDING",
            IsApproved = false
        };
    }

    public async Task<CheckoutResponse> CreateOrderAsync(Guid tenantId, CreateCheckoutRequest request)
    {
        var totalAmount = request.Items.Sum(i => i.UnitPrice * i.Quantity);
        var externalRef = !string.IsNullOrEmpty(request.ExternalReference) 
            ? request.ExternalReference 
            : $"ord_{tenantId.ToString()[..8]}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";

        var order = new Order
        {
            TenantId = tenantId,
            ExternalReference = externalRef,
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

        var isPix = request.PaymentMethod.ToLower() == "pix";

        var mpRequest = new MercadoPagoOrderRequest
        {
            Type = "online",
            ProcessingMode = "automatic",
            ExternalReference = externalRef,
            TotalAmount = totalAmount.ToString("F2", System.Globalization.CultureInfo.InvariantCulture),
            Description = "Pedido E-commerce Bot",
            Payer = new MercadoPagoPayerRequest
            {
                Email = request.PayerEmail ?? "cliente@ecommercebot.local"
            },
            Transactions = new MercadoPagoTransactionsRequest
            {
                Payments = new MercadoPagoPaymentRequest
                {
                    Amount = totalAmount.ToString("F2", System.Globalization.CultureInfo.InvariantCulture),
                    PaymentMethod = new MercadoPagoPaymentMethodRequest
                    {
                        Id = isPix ? "pix" : "visa",
                        Type = isPix ? "bank_transfer" : "credit_card"
                    },
                    ExpirationTime = isPix ? "PT30M" : null
                }
            },
            Items = request.Items.Select(i => new MercadoPagoItemRequest
            {
                Title = i.Title,
                UnitPrice = i.UnitPrice.ToString("F2", System.Globalization.CultureInfo.InvariantCulture),
                Quantity = i.Quantity,
                ExternalCode = i.ExternalCode
            }).ToList()
        };

        var mpResponse = await _mercadoPagoGateway.CreateOrderAsync(mpRequest);
        var firstPayment = mpResponse.Transactions?.Payments?.FirstOrDefault();

        order.MpPaymentId = firstPayment?.Id ?? mpResponse.Id;
        order.PixQrCode = firstPayment?.PaymentMethod?.QrCode;
        order.PixQrCodeBase64 = firstPayment?.PaymentMethod?.QrCodeBase64;
        order.TicketUrl = firstPayment?.PaymentMethod?.TicketUrl;
        order.PixExpirationDate = isPix ? DateTimeOffset.UtcNow.AddMinutes(30) : null;

        var savedOrder = await _orderRepository.CreateOrderAsync(order);

        return new CheckoutResponse
        {
            Id = savedOrder.Id,
            ExternalReference = savedOrder.ExternalReference ?? string.Empty,
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

    private async Task<Plan?> ResolvePlanAsync(string planIdStr)
    {
        if (Guid.TryParse(planIdStr, out var planGuid))
        {
            return await _planRepository.GetByIdAsync(planGuid);
        }

        // Tenta encontrar por nome aproximado ("pro-plan" -> "Pro")
        var allPlans = await _planRepository.GetAllAsync(onlyActive: true);
        return allPlans.FirstOrDefault(p => 
            p.Name.Contains("Pro", StringComparison.OrdinalIgnoreCase) ||
            p.Id.ToString().StartsWith(planIdStr, StringComparison.OrdinalIgnoreCase)) 
            ?? allPlans.FirstOrDefault();
    }
}
