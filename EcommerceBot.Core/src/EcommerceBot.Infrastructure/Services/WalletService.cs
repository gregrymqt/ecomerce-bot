using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Application.DTOs.MercadoPago;
using EcommerceBot.Application.DTOs.Wallet;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

public sealed class WalletService : IWalletService
{
    private readonly ITenantRepository _tenantRepository;
    private readonly IPlanRepository _planRepository;
    private readonly IOrderRepository _orderRepository;
    private readonly IMercadoPagoGateway _mercadoPagoGateway;
    private readonly ILogger<WalletService> _logger;

    public WalletService(
        ITenantRepository tenantRepository,
        IPlanRepository planRepository,
        IOrderRepository orderRepository,
        IMercadoPagoGateway mercadoPagoGateway,
        ILogger<WalletService> logger)
    {
        _tenantRepository = tenantRepository;
        _planRepository = planRepository;
        _orderRepository = orderRepository;
        _mercadoPagoGateway = mercadoPagoGateway;
        _logger = logger;
    }

    public async Task<WalletBalanceResponseDto> GetBalanceAsync(Guid tenantId)
    {
        var tenant = await _tenantRepository.GetByIdAsync(tenantId);
        if (tenant == null)
        {
            throw new ArgumentException("Tenant não encontrado.");
        }

        return new WalletBalanceResponseDto
        {
            TenantId = tenant.Id,
            BalanceCredits = tenant.CreditsBalance,
            ManagedCreditBalance = tenant.ManagedCreditBalance,
            UpdatedAt = tenant.UpdatedAt
        };
    }

    public async Task<WalletStatementResponseDto> GetStatementAsync(Guid tenantId, StatementFiltersDto filters)
    {
        var tenant = await _tenantRepository.GetByIdAsync(tenantId);
        var balanceCredits = tenant?.CreditsBalance ?? 0;
        var managedBalance = tenant?.ManagedCreditBalance ?? 0.00m;

        var page = filters.Page > 0 ? filters.Page : 1;
        var limit = filters.Limit > 0 ? filters.Limit : 50;
        var offset = (page - 1) * limit;

        var transactions = await _tenantRepository.GetCreditTransactionsAsync(tenantId, limit, offset, filters.Type);
        var totalCount = await _tenantRepository.CountCreditTransactionsAsync(tenantId, filters.Type);

        var transactionDtos = transactions.Select(t => new CreditTransactionDto
        {
            Id = t.Id.ToString(),
            TenantId = t.TenantId,
            Amount = t.Amount,
            BalanceAfter = t.BalanceAfter,
            Type = t.Type,
            Description = t.Description,
            ReferenceId = t.ReferenceId,
            ExternalPaymentId = t.ReferenceId ?? t.OrderId?.ToString(),
            CreatedAt = t.CreatedAt
        }).ToList();

        return new WalletStatementResponseDto
        {
            BalanceCredits = balanceCredits,
            ManagedCreditBalance = managedBalance,
            Transactions = transactionDtos,
            TotalCount = totalCount
        };
    }

    public async Task<RechargeResponseDto> CreateRechargeAsync(Guid tenantId, RechargeRequestDto request)
    {
        Guid? planId = null;
        if (!string.IsNullOrEmpty(request.PackageId) && Guid.TryParse(request.PackageId, out var parsedId))
        {
            planId = parsedId;
        }

        var amount = request.Amount > 0 ? request.Amount : (request.CreditsPackage > 0 ? request.CreditsPackage * 0.50m : 50.00m);
        var isPix = request.PaymentMethod.ToLower() == "pix";
        var externalRef = $"rec_{tenantId.ToString()[..8]}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";

        var order = new Order
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PlanId = planId,
            ExternalReference = externalRef,
            TotalAmount = amount,
            Status = "pending",
            PaymentMethod = request.PaymentMethod.ToLower(),
            PayerEmail = request.PayerEmail ?? request.Payer?.Email ?? "cliente@ecommercebot.local",
            PayerDocumentNumber = request.Payer?.Identification?.Number,
            PayerDocumentType = request.Payer?.Identification?.Type ?? "CPF",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
            Items = new List<OrderItem>
            {
                new()
                {
                    Title = $"Recarga de Carteira - Saldo IA (R$ {amount:F2})",
                    UnitPrice = amount,
                    Quantity = 1,
                    ExternalCode = "WALLET_TOPUP"
                }
            }
        };

        var mpRequest = new MercadoPagoOrderRequest
        {
            Type = "online",
            ProcessingMode = "automatic",
            ExternalReference = externalRef,
            TotalAmount = amount.ToString("F2", System.Globalization.CultureInfo.InvariantCulture),
            Description = $"Recarga de Créditos - E-commerce Bot",
            Payer = new MercadoPagoPayerRequest
            {
                Email = order.PayerEmail,
                Identification = !string.IsNullOrEmpty(order.PayerDocumentNumber) ? new MercadoPagoIdentificationRequest
                {
                    Type = order.PayerDocumentType ?? "CPF",
                    Number = order.PayerDocumentNumber.Replace(".", "").Replace("-", "")
                } : null
            },
            Transactions = new MercadoPagoTransactionsRequest
            {
                Payments = new MercadoPagoPaymentRequest
                {
                    Amount = amount.ToString("F2", System.Globalization.CultureInfo.InvariantCulture),
                    PaymentMethod = new MercadoPagoPaymentMethodRequest
                    {
                        Id = isPix ? "pix" : (request.PaymentMethodId ?? "visa"),
                        Type = isPix ? "bank_transfer" : "credit_card",
                        Token = request.CardToken,
                        Installments = isPix ? null : request.Installments,
                        StatementDescriptor = "ECOMAUTOBOT"
                    },
                    ExpirationTime = isPix ? "PT30M" : null
                }
            },
            Items = new List<MercadoPagoItemRequest>
            {
                new()
                {
                    Title = "Recarga de Créditos",
                    UnitPrice = amount.ToString("F2", System.Globalization.CultureInfo.InvariantCulture),
                    Quantity = 1,
                    Description = "Recarga de Saldo de IA",
                    ExternalCode = "WALLET_TOPUP"
                }
            }
        };

        var mpResponse = await _mercadoPagoGateway.CreateOrderAsync(mpRequest);

        var firstPayment = mpResponse.Transactions?.Payments?.FirstOrDefault();
        order.MpPaymentId = firstPayment?.Id ?? mpResponse.Id;
        order.PixQrCode = firstPayment?.PaymentMethod?.QrCode;
        order.PixQrCodeBase64 = firstPayment?.PaymentMethod?.QrCodeBase64;
        order.TicketUrl = firstPayment?.PaymentMethod?.TicketUrl;
        
        if (mpResponse.Status == "processed" && mpResponse.StatusDetail == "accredited")
        {
            order.Status = "approved";
            order.PaidAt = DateTimeOffset.UtcNow;
            order.TotalPaidAmount = amount;

            int creditsToAdd = request.CreditsPackage;
            string packageName = "Recarga de Créditos";

            if (order.PlanId.HasValue)
            {
                var plan = await _planRepository.GetByIdAsync(order.PlanId.Value);
                if (plan != null)
                {
                    creditsToAdd = plan.CreditsIncluded;
                    packageName = plan.Name;
                }
            }

            if (creditsToAdd <= 0)
            {
                creditsToAdd = (int)Math.Ceiling(amount * 10);
            }

            await _tenantRepository.AddCreditsAsync(
                tenantId: tenantId,
                amount: creditsToAdd,
                type: "RECHARGE",
                description: $"Recarga de IA aprovada: {packageName} (+{creditsToAdd} créditos)",
                referenceId: order.ExternalReference ?? order.MpPaymentId,
                orderId: order.Id
            );
        }

        await _orderRepository.CreateOrderAsync(order);

        return new RechargeResponseDto
        {
            PaymentId = order.MpPaymentId ?? order.Id.ToString(),
            Status = order.Status,
            PixQrCode = order.PixQrCodeBase64,
            PixCopiaECola = order.PixQrCode,
            ExpirationDate = DateTimeOffset.UtcNow.AddMinutes(30).ToString("o")
        };
    }
}
