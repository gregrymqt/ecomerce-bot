using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Application.DTOs.MercadoPago;
using EcommerceBot.Application.DTOs.Wallet;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using EcommerceBot.Infrastructure.Utils;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

public sealed class WalletService : IWalletService
{
    private readonly ITenantRepository _tenantRepository;
    private readonly IPlanRepository _planRepository;
    private readonly IOrderRepository _orderRepository;
    private readonly IMercadoPagoGateway _mercadoPagoGateway;
    private readonly ITenantBillingProfileRepository _tenantBillingProfileRepository;
    private readonly ILogger<WalletService> _logger;
    private readonly WalletUtils _walletUtils;
    private readonly IUserRepository _userRepository;

    public WalletService(
        ITenantRepository tenantRepository,
        IPlanRepository planRepository,
        IOrderRepository orderRepository,
        IMercadoPagoGateway mercadoPagoGateway,
        ITenantBillingProfileRepository tenantBillingProfileRepository,
        ILogger<WalletService> logger,
        WalletUtils walletUtils,
        IUserRepository userRepository
    )
    {
        _tenantRepository = tenantRepository;
        _planRepository = planRepository;
        _orderRepository = orderRepository;
        _mercadoPagoGateway = mercadoPagoGateway;
        _tenantBillingProfileRepository = tenantBillingProfileRepository;
        _logger = logger;
        _walletUtils = walletUtils;
        _userRepository = userRepository;
    }

    public async Task<WalletBalanceResponseDto> GetBalanceAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            var tenant = await _tenantRepository.GetByIdAsync(tenantId, cancellationToken);
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
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao obter saldo da carteira para o Tenant {TenantId}", tenantId);
            throw;
        }
    }

    public async Task<WalletStatementResponseDto> GetStatementAsync(Guid tenantId, StatementFiltersDto filters, CancellationToken cancellationToken = default)
    {
        try
        {
            var tenant = await _tenantRepository.GetByIdAsync(tenantId, cancellationToken);
            var balanceCredits = tenant?.CreditsBalance ?? 0;
            var managedBalance = tenant?.ManagedCreditBalance ?? 0.00m;

            var page = filters.Page > 0 ? filters.Page : 1;
            var limit = filters.Limit > 0 ? filters.Limit : 50;
            var offset = (page - 1) * limit;

            var transactions = await _tenantRepository.GetCreditTransactionsAsync(tenantId, limit, offset, filters.Type, cancellationToken);
            var totalCount = await _tenantRepository.CountCreditTransactionsAsync(tenantId, filters.Type, cancellationToken);

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
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao obter extrato da carteira para o Tenant {TenantId}", tenantId);
            throw;
        }
    }

    public async Task<RechargeResponseDto> CreateRechargeAsync(
    Guid tenantId,
    CreateRechargeRequestDto request,
    CancellationToken cancellationToken = default)
    {
        if (request.Amount <= 0)
        {
            _logger.LogWarning("Tentativa de recarga com valor inválido ({Amount}) para o Tenant {TenantId}", request.Amount, tenantId);
            throw new ArgumentException($"O valor da recarga deve ser maior que zero (recebido: {request.Amount}).", nameof(request));
        }

        var isPix = string.Equals(request.PaymentMethod, "pix", StringComparison.OrdinalIgnoreCase);
        var paymentMethodId = isPix ? "pix" : (!string.IsNullOrWhiteSpace(request.PaymentMethodId) ? request.PaymentMethodId.ToLowerInvariant() : "credit_card");
        var totalAmountFormatted = request.Amount.ToString("F2", CultureInfo.InvariantCulture);

        var externalRef = $"rec_{tenantId.ToString()[..8]}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";

        _logger.LogInformation(
            "Iniciando recarga {ExternalReference} para o Tenant {TenantId} no valor de R$ {TotalAmount} via {Method}",
            externalRef, tenantId, totalAmountFormatted, paymentMethodId);

        try
        {
            var payerEmail = request.Payer?.Email;
            var user = await GetUserByEmailAsync(payerEmail, cancellationToken);
            var billingProfile = await _tenantBillingProfileRepository.GetByTenantIdAsync(tenantId, cancellationToken);

            // Se a requisição trouxe dados de documento/endereço, atualiza o perfil fiscal do Tenant
            if (request.Payer?.IdentificationNumber is { Length: >= 11 } &&
                request.Payer?.Address is { ZipCode.Length: >= 8, StreetName.Length: > 0 })
            {
                var cleanDoc = _walletUtils.CleanDocumentSpan(request.Payer.IdentificationNumber.AsSpan());
                var docType = request.Payer.IdentificationType ?? (cleanDoc.Length == 14 ? "CNPJ" : "CPF");
                var cleanZip = _walletUtils.CleanDocumentSpan(request.Payer.Address.ZipCode.AsSpan());
                var fullName = $"{request.Payer.FirstName} {request.Payer.LastName}".Trim();
                if (string.IsNullOrWhiteSpace(fullName)) fullName = user?.FullName ?? "Lojista";

                billingProfile = await _tenantBillingProfileRepository.UpsertAsync(new TenantBillingProfile
                {
                    TenantId = tenantId,
                    LegalName = fullName,
                    DocumentType = docType,
                    DocumentNumber = cleanDoc,
                    Email = request.Payer.Email ?? user?.Email,
                    ZipCode = cleanZip,
                    StreetName = request.Payer.Address.StreetName ?? string.Empty,
                    StreetNumber = request.Payer.Address.StreetNumber ?? "S/N",
                    Complement = request.Payer.Address.Complement,
                    Neighborhood = request.Payer.Address.Neighborhood ?? string.Empty,
                    City = request.Payer.Address.City ?? string.Empty,
                    FederalUnit = request.Payer.Address.FederalUnit ?? "SP"
                }, cancellationToken);
            }

            var payerRequest = _walletUtils.BuildMercadoPagoPayer(user, request.Payer, billingProfile);

            var plan = !string.IsNullOrEmpty(request.PackageId)
                ? await ResolvePlanAsync(request.PackageId, cancellationToken)
                : null;

            Order order = new()
            {
                TenantId = tenantId,
                PlanId = plan?.Id,
                UserId = user?.Id,
                ExternalReference = externalRef,
                PayerName = $"{payerRequest.FirstName} {payerRequest.LastName}".Trim(),
                PayerEmail = payerRequest.Email,
                PayerDocumentType = payerRequest.Identification?.Type ?? "CPF",
                PayerDocumentNumber = payerRequest.Identification?.Number,
                PayerZipCode = payerRequest.Address?.ZipCode,
                PayerStreetName = payerRequest.Address?.StreetName,
                PayerStreetNumber = payerRequest.Address?.StreetNumber,
                PayerComplement = payerRequest.Address?.Complement,
                PayerNeighborhood = payerRequest.Address?.Neighborhood,
                PayerCity = payerRequest.Address?.City,
                PayerFederalUnit = payerRequest.Address?.FederalUnit,
                PaymentMethod = paymentMethodId,
                TotalAmount = request.Amount,
                Status = "pending",
                Items =
                [
                    new OrderItem
                {
                    Title = $"Recarga de Saldo IA (R$ {totalAmountFormatted})",
                    UnitPrice = request.Amount,
                    Quantity = 1,
                    ExternalCode = request.PackageId ?? "WALLET_TOPUP"
                }
                ]
            };

            var mpRequest = new MercadoPagoOrderRequest
            {
                Type = "online",
                ProcessingMode = "automatic",
                ExternalReference = externalRef,
                TotalAmount = totalAmountFormatted,
                Description = $"Recarga de Créditos IA - E-commerce Bot",
                Payer = payerRequest,
                Transactions = new MercadoPagoTransactionsRequest
                {
                    Payments =
                    [
                        new MercadoPagoPaymentRequest
                    {
                        Amount = totalAmountFormatted,
                        PaymentMethod = new MercadoPagoPaymentMethodRequest
                        {
                            Id = isPix ? "pix" : paymentMethodId,
                            Type = isPix ? "bank_transfer" : "credit_card",
                            Token = isPix ? null : request.CardToken,
                            Installments = isPix ? null : request.Installments,
                            StatementDescriptor = "ECOMAUTOBOT"
                        },
                        ExpirationTime = isPix ? "PT30M" : null
                    }
                    ]
                },
                Items =
                [
                    new MercadoPagoItemRequest
                {
                    Title = "Recarga de Créditos",
                    UnitPrice = totalAmountFormatted,
                    Quantity = 1,
                    Description = "Recarga de Saldo de IA",
                    ExternalCode = request.PackageId ?? "WALLET_TOPUP"
                }
                ]
            };

            var mpResponse = await _mercadoPagoGateway.CreateOrderAsync(mpRequest, cancellationToken: cancellationToken);
            var firstPayment = mpResponse.Transactions?.Payments?.FirstOrDefault();

            // Extrai identificador do pagamento e dados de PIX
            var numericPaymentId = firstPayment?.Reference?.Id?.ToString();
            order.MpPaymentId = !string.IsNullOrEmpty(numericPaymentId)
                ? numericPaymentId
                : (firstPayment?.Id ?? mpResponse.Id);
            order.PixQrCode = firstPayment?.PaymentMethod?.QrCode;
            order.PixQrCodeBase64 = firstPayment?.PaymentMethod?.QrCodeBase64;
            order.TicketUrl = firstPayment?.PaymentMethod?.TicketUrl;
            order.PixExpirationDate = isPix ? DateTimeOffset.UtcNow.AddMinutes(30) : null;


            // Se for aprovado instantaneamente (cartão de crédito)
            if (firstPayment?.Status is "approved" || mpResponse.Status is "processed" or "approved")
            {
                order.Status = "approved";
                order.PaidAt = DateTimeOffset.UtcNow;
                order.TotalPaidAmount = request.Amount;
            }

            // 1. Salva a Order PRIMEIRO (Garante o ID no banco para satisfazer a Foreign Key)
            var savedOrder = await _orderRepository.CreateOrderAsync(order, cancellationToken);

            _logger.LogInformation(
                "Pedido de recarga {OrderId} persistido com status {Status} para o Tenant {TenantId}",
                savedOrder.Id, savedOrder.Status, tenantId);

            // 3. Converte para o DTO de contrato limpo da Wallet
            return _walletUtils.ToRechargeResponseDto(mpResponse, savedOrder);
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro no fluxo de recarga para o Tenant {TenantId}. Ref: {ExternalReference}, Montante: {TotalAmount}",
                tenantId, externalRef, request.Amount);
            throw;
        }
    }

    public async Task<RechargeResponseDto?> GetRechargeByIdAsync(
    Guid orderId,
    Guid tenantId,
    CancellationToken cancellationToken = default)
    {
        var order = await _orderRepository.GetOrderByIdAsync(orderId, tenantId, cancellationToken);
        if (order is null) return null;

        return new RechargeResponseDto
        {
            OrderId = order.Id,
            PaymentId = order.MpPaymentId ?? order.Id.ToString(),
            Status = order.Status,
            PaymentMethod = order.PaymentMethod,
            TotalAmount = order.TotalAmount,
            PixQrCode = order.PixQrCode,
            PixQrCodeBase64 = order.PixQrCodeBase64,
            TicketUrl = order.TicketUrl,
            ExpirationDate = order.PixExpirationDate
        };
    }


    #region Métodos Privados Auxiliares

    private async Task<User?> GetUserByEmailAsync(string? email, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(email)) return null;
        return await _userRepository.GetByEmailAsync(email, ct);
    }

    public async Task CreditTenantAsync(
        Guid tenantId,
        Order order,
        Plan? plan,
        CancellationToken ct)
    {
        var creditsToAdd = plan?.CreditsIncluded ?? (int)Math.Ceiling(order.TotalAmount * 10);

        await _tenantRepository.AddCreditsAsync(
            tenantId: tenantId,
            amount: creditsToAdd,
            type: "RECHARGE",
            description: $"Recarga de IA confirmada (+{creditsToAdd} créditos)",
            referenceId: order.ExternalReference,
            orderId: order.Id,
            cancellationToken: ct
        );

        _logger.LogInformation(
            "Adicionados {Credits} créditos para o Tenant {TenantId} referente ao Pedido {OrderId}",
            creditsToAdd, tenantId, order.Id);
    }

    public async Task<Plan?> ResolvePlanAsync(string planIdOrCode, CancellationToken ct)
    {
        if (Guid.TryParse(planIdOrCode, out var planGuid))
        {
            return await _planRepository.GetByIdAsync(planGuid, ct);
        }

        var allPlans = await _planRepository.GetAllAsync(onlyActive: true, ct);
        return allPlans.FirstOrDefault(p =>
            p.Name.Contains(planIdOrCode, StringComparison.OrdinalIgnoreCase) ||
            p.Id.ToString().StartsWith(planIdOrCode, StringComparison.OrdinalIgnoreCase))
            ?? allPlans.FirstOrDefault();
    }

    #endregion

}
