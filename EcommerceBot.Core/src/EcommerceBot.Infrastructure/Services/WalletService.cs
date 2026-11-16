using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Application.DTOs.Stripe;
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
    private readonly IStripeGateway _stripeGateway;
    private readonly ITenantBillingProfileRepository _tenantBillingProfileRepository;
    private readonly ILogger<WalletService> _logger;
    private readonly IWalletUtils _walletUtils;
    private readonly IUserRepository _userRepository;

    public WalletService(
        ITenantRepository tenantRepository,
        IPlanRepository planRepository,
        IOrderRepository orderRepository,
        IStripeGateway stripeGateway,
        ITenantBillingProfileRepository tenantBillingProfileRepository,
        ILogger<WalletService> logger,
        IWalletUtils walletUtils,
        IUserRepository userRepository
    )
    {
        _tenantRepository = tenantRepository;
        _planRepository = planRepository;
        _orderRepository = orderRepository;
        _stripeGateway = stripeGateway;
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
            var initialPayerEmail = request.Payer?.Email;
            var user = await GetUserByEmailAsync(initialPayerEmail, tenantId, cancellationToken);
            var billingProfile = await _tenantBillingProfileRepository.GetByTenantIdAsync(tenantId, cancellationToken);

            // Se a requisição trouxe dados de documento/endereço, atualiza o perfil fiscal do Tenant
            if (request.Payer?.IdentificationNumber is { Length: >= 11 } &&
                request.Payer?.Address is { ZipCode.Length: >= 8, StreetName.Length: > 0 })
            {
                var profCleanDoc = _walletUtils.CleanDocumentSpan(request.Payer.IdentificationNumber.AsSpan());
                var profDocType = request.Payer.IdentificationType ?? (profCleanDoc.Length == 14 ? "CNPJ" : "CPF");
                var cleanZip = _walletUtils.CleanDocumentSpan(request.Payer.Address.ZipCode.AsSpan());
                var fullName = $"{request.Payer.FirstName} {request.Payer.LastName}".Trim();
                if (string.IsNullOrWhiteSpace(fullName)) fullName = user?.FullName ?? "Lojista";

                billingProfile = await _tenantBillingProfileRepository.UpsertAsync(new TenantBillingProfile
                {
                    TenantId = tenantId,
                    LegalName = fullName,
                    DocumentType = profDocType,
                    DocumentNumber = profCleanDoc,
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

            var (firstName, lastName) = _walletUtils.ExtractNames(request.Payer?.FirstName != null ? $"{request.Payer.FirstName} {request.Payer.LastName}" : (billingProfile?.LegalName ?? user?.FullName));
            var payerEmail = request.Payer?.Email ?? billingProfile?.Email ?? user?.Email ?? "financeiro@ecommercebot.local";
            var payerFullName = $"{firstName} {lastName}".Trim();
            var docType = request.Payer?.IdentificationType ?? billingProfile?.DocumentType ?? "CPF";
            var rawDoc = request.Payer?.IdentificationNumber ?? billingProfile?.DocumentNumber ?? string.Empty;
            var cleanDoc = _walletUtils.CleanDocumentSpan(rawDoc.AsSpan());

            Plan? plan = null;
            if (!string.IsNullOrWhiteSpace(request.PackageId))
            {
                plan = await ResolvePlanAsync(request.PackageId, cancellationToken);
                if (plan is null)
                {
                    throw new ArgumentException($"Pacote '{request.PackageId}' não encontrado ou inativo.", nameof(request));
                }

                if (request.Amount < plan.Price)
                {
                    throw new ArgumentException(
                        $"Valor da recarga (R$ {request.Amount:F2}) é inferior ao preço do pacote '{plan.Name}' (R$ {plan.Price:F2}).",
                        nameof(request));
                }
            }

            Order order = new()
            {
                TenantId = tenantId,
                PlanId = plan?.Id,
                UserId = user?.Id,
                ExternalReference = externalRef,
                PayerName = payerFullName,
                PayerEmail = payerEmail,
                PayerDocumentType = docType,
                PayerDocumentNumber = cleanDoc,
                PayerZipCode = request.Payer?.Address?.ZipCode ?? billingProfile?.ZipCode,
                PayerStreetName = request.Payer?.Address?.StreetName ?? billingProfile?.StreetName,
                PayerStreetNumber = request.Payer?.Address?.StreetNumber ?? billingProfile?.StreetNumber,
                PayerComplement = request.Payer?.Address?.Complement ?? billingProfile?.Complement,
                PayerNeighborhood = request.Payer?.Address?.Neighborhood ?? billingProfile?.Neighborhood,
                PayerCity = request.Payer?.Address?.City ?? billingProfile?.City,
                PayerFederalUnit = request.Payer?.Address?.FederalUnit ?? billingProfile?.FederalUnit,
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

            var stripeRequest = new CreatePaymentIntentRequest
            {
                Amount = request.Amount,
                Currency = "brl",
                Description = "Recarga de Créditos IA - E-commerce Bot",
                CustomerEmail = payerEmail,
                Metadata = new Dictionary<string, string>
                {
                    ["tenant_id"] = tenantId.ToString(),
                    ["external_reference"] = externalRef,
                    ["package_id"] = request.PackageId ?? "WALLET_TOPUP",
                    ["payer_name"] = payerFullName
                },
                EnableAutomaticTax = true
            };

            var stripeResponse = await _stripeGateway.CreatePaymentIntentAsync(stripeRequest, idempotencyKey: externalRef, cancellationToken: cancellationToken);

            order.MpPaymentId = stripeResponse.Id;
            order.Status = string.Equals(stripeResponse.Status, "succeeded", StringComparison.OrdinalIgnoreCase) ? "approved" : "pending";

            if (string.Equals(stripeResponse.Status, "succeeded", StringComparison.OrdinalIgnoreCase))
            {
                order.PaidAt = DateTimeOffset.UtcNow;
                order.TotalPaidAmount = request.Amount;
            }

            // 1. Salva a Order PRIMEIRO (Garante o ID no banco para satisfazer a Foreign Key)
            var savedOrder = await _orderRepository.CreateOrderAsync(order, cancellationToken);

            // Se aprovado instantaneamente, concede créditos atomicamente uma única vez (idempotente com webhook futuro)
            if (string.Equals(savedOrder.Status, "approved", StringComparison.OrdinalIgnoreCase))
            {
                var creditsToAdd = plan?.CreditsIncluded > 0
                    ? plan.CreditsIncluded
                    : (int)Math.Ceiling(savedOrder.TotalAmount * 10);
                var packageName = plan?.Name ?? "Recarga de Créditos";

                await _tenantRepository.TryCreditOrderOnceAsync(
                    tenantId: tenantId,
                    orderId: savedOrder.Id,
                    amount: creditsToAdd,
                    type: "RECHARGE",
                    description: $"Recarga de IA aprovada: {packageName} (+{creditsToAdd} créditos)",
                    referenceId: savedOrder.ExternalReference ?? savedOrder.MpPaymentId,
                    mpPaymentId: savedOrder.MpPaymentId,
                    paidAmount: savedOrder.TotalPaidAmount > 0 ? savedOrder.TotalPaidAmount : savedOrder.TotalAmount,
                    cancellationToken: cancellationToken);
            }

            _logger.LogInformation(
                "Pedido de recarga {OrderId} persistido com status {Status} para o Tenant {TenantId}",
                savedOrder.Id, savedOrder.Status, tenantId);

            // 3. Converte para o DTO de contrato limpo da Wallet
            return _walletUtils.ToRechargeResponseDto(stripeResponse, savedOrder);
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

    private async Task<User?> GetUserByEmailAsync(string? email, Guid tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(email)) return null;
        return await _userRepository.GetByEmailAndTenantAsync(email, tenantId, ct);
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
            p.Id.ToString().StartsWith(planIdOrCode, StringComparison.OrdinalIgnoreCase));
    }

    #endregion

}
