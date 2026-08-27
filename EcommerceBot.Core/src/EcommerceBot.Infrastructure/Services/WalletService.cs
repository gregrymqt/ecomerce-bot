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

public class WalletService : IWalletService
{
    private readonly ITenantRepository _tenantRepository;
    private readonly IOrderRepository _orderRepository;
    private readonly IMercadoPagoGateway _mercadoPagoGateway;
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly ILogger<WalletService> _logger;

    public WalletService(
        ITenantRepository tenantRepository,
        IOrderRepository orderRepository,
        IMercadoPagoGateway mercadoPagoGateway,
        IDbConnectionFactory connectionFactory,
        ILogger<WalletService> logger)
    {
        _tenantRepository = tenantRepository;
        _orderRepository = orderRepository;
        _mercadoPagoGateway = mercadoPagoGateway;
        _connectionFactory = connectionFactory;
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

        using var connection = await _connectionFactory.CreateConnectionAsync();
        
        // Busca ordens de pagamento aprovadas e pendentes
        const string sqlOrders = @"
            SELECT Id, TenantId, TotalAmount, Status, PaymentMethod, MpPaymentId, CreatedAt 
            FROM dbo.Orders 
            WHERE TenantId = @TenantId 
            ORDER BY CreatedAt DESC";

        var orders = (await connection.QueryAsync<Order>(sqlOrders, new { TenantId = tenantId })).ToList();

        var transactions = orders.Select(o => new CreditTransactionDto
        {
            Id = o.Id.ToString(),
            TenantId = o.TenantId,
            Amount = o.TotalAmount,
            Type = "RECHARGE",
            Description = $"Recarga via {o.PaymentMethod?.ToUpper()} ({o.Status})",
            ExternalPaymentId = o.MpPaymentId,
            CreatedAt = o.CreatedAt
        }).ToList();

        return new WalletStatementResponseDto
        {
            BalanceCredits = balanceCredits,
            ManagedCreditBalance = managedBalance,
            Transactions = transactions.Skip((filters.Page - 1) * filters.Limit).Take(filters.Limit).ToList(),
            TotalCount = transactions.Count
        };
    }

    public async Task<RechargeResponseDto> CreateRechargeAsync(Guid tenantId, RechargeRequestDto request)
    {
        var amount = request.Amount > 0 ? request.Amount : (request.CreditsPackage > 0 ? request.CreditsPackage * 0.50m : 50.00m);
        var isPix = request.PaymentMethod.ToLower() == "pix";
        var externalRef = $"rec_{tenantId.ToString()[..8]}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";

        var order = new Order
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
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
            await _tenantRepository.AddManagedBalanceAsync(tenantId, amount);
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
