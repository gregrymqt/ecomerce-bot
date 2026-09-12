using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.MercadoPago;
using EcommerceBot.Application.DTOs.Wallet;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

public sealed class CheckoutService : ICheckoutService
{
    private readonly IOrderRepository _orderRepository;
    private readonly IPlanRepository _planRepository;
    private readonly ITenantRepository _tenantRepository;
    private readonly IMercadoPagoGateway _mercadoPagoGateway;
    private readonly IUserRepository _userRepository;
    private readonly ITenantBillingProfileRepository _tenantBillingProfileRepository;
    private readonly ILogger<CheckoutService> _logger;

    public CheckoutService(
        IOrderRepository orderRepository,
        IPlanRepository planRepository,
        ITenantRepository tenantRepository,
        IMercadoPagoGateway mercadoPagoGateway,
        IUserRepository userRepository,
        ITenantBillingProfileRepository tenantBillingProfileRepository,
        ILogger<CheckoutService> logger)
    {
        _orderRepository = orderRepository;
        _planRepository = planRepository;
        _tenantRepository = tenantRepository;
        _mercadoPagoGateway = mercadoPagoGateway;
        _userRepository = userRepository;
        _tenantBillingProfileRepository = tenantBillingProfileRepository;
        _logger = logger;
    }

    public async Task<MercadoPagoOrderResponse> CreateOrderAsync(
        Guid tenantId,
        MercadoPagoOrderRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.Items is not { Count: > 0 })
        {
            _logger.LogWarning("Tentativa de checkout sem itens para o Tenant {TenantId}", tenantId);
            throw new ArgumentException("O pedido precisa conter ao menos um item.", nameof(request));
        }

        // Fórmulas e montantes de pagamento
        decimal totalAmount;
        if (!decimal.TryParse(request.TotalAmount, NumberStyles.Any, CultureInfo.InvariantCulture, out totalAmount) || totalAmount <= 0)
        {
            totalAmount = request.Items.Sum(static i =>
            {
                _ = decimal.TryParse(i.UnitPrice, NumberStyles.Any, CultureInfo.InvariantCulture, out var price);
                return price * i.Quantity;
            });
        }
        var formattedTotal = totalAmount.ToString("F2", CultureInfo.InvariantCulture);

        var externalRef = !string.IsNullOrWhiteSpace(request.ExternalReference)
            ? request.ExternalReference
            : $"ord_{tenantId.ToString()[..8]}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";

        _logger.LogInformation(
            "Iniciando checkout de {ExternalReference} para o Tenant {TenantId} no valor de {TotalAmount}",
            externalRef, tenantId, totalAmount);

        // 1. Resolve usuário e perfil fiscal/endereço de faturamento do Tenant
        var payerEmail = request.Payer?.Email;
        var user = await GetUserByEmailAsync(payerEmail, cancellationToken);
        var billingProfile = await _tenantBillingProfileRepository.GetByTenantIdAsync(tenantId, cancellationToken);

        // Se a requisição trouxe dados de documento/endereço, efetua upsert no perfil de faturamento do Tenant
        if (request.Payer?.Identification is { Number.Length: >= 11 } &&
            request.Payer?.Address is { ZipCode.Length: >= 8, StreetName.Length: > 0 })
        {
            var cleanDoc = CleanDocumentSpan(request.Payer.Identification.Number.AsSpan());
            var docType = request.Payer.Identification.Type ?? (cleanDoc.Length == 14 ? "CNPJ" : "CPF");
            var cleanZip = CleanDocumentSpan(request.Payer.Address.ZipCode.AsSpan());
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

        var payerRequest = BuildMercadoPagoPayer(user, request.Payer, billingProfile);

        // 2. Resolve plano para liberação futura de créditos
        var firstItemCode = request.Items.FirstOrDefault()?.ExternalCode;
        var plan = !string.IsNullOrEmpty(firstItemCode)
            ? await ResolvePlanAsync(firstItemCode, cancellationToken)
            : null;

        var firstPaymentRequest = request.Transactions?.Payments?.FirstOrDefault();
        var paymentMethodId = firstPaymentRequest?.PaymentMethod?.Id ??
            (string.Equals(firstPaymentRequest?.PaymentMethod?.Type, "bank_transfer", StringComparison.OrdinalIgnoreCase) ? "pix" : "credit_card");

        var isPix = string.Equals(paymentMethodId, "pix", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(firstPaymentRequest?.PaymentMethod?.Type, "bank_transfer", StringComparison.OrdinalIgnoreCase);

        // 3. Monta entidade de domínio com Target-Typed new e snapshot fiscal/endereço
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
            TotalAmount = totalAmount,
            Status = "pending",
            Items = [.. request.Items.Select(static i =>
            {
                _ = decimal.TryParse(i.UnitPrice, NumberStyles.Any, CultureInfo.InvariantCulture, out var p);
                return new OrderItem
                {
                    Title = i.Title,
                    UnitPrice = p,
                    Quantity = i.Quantity,
                    ExternalCode = i.ExternalCode
                };
            })]
        };

        // 4. Monta DTO do Gateway unificado
        var mpRequest = request with
        {
            ExternalReference = externalRef,
            TotalAmount = formattedTotal,
            Payer = payerRequest
        };

        var mpResponse = await _mercadoPagoGateway.CreateOrderAsync(mpRequest, cancellationToken: cancellationToken);
        var firstPayment = mpResponse.Transactions?.Payments?.FirstOrDefault();

        // 5. Atualiza o pedido com a resposta do gateway (prioriza ID numérico de pagamento)
        var numericPaymentId = firstPayment?.Reference?.Id?.ToString();
        order.MpPaymentId = !string.IsNullOrEmpty(numericPaymentId)
            ? numericPaymentId
            : (firstPayment?.Id ?? mpResponse.Id);
        order.PixQrCode = firstPayment?.PaymentMethod?.QrCode;
        order.PixQrCodeBase64 = firstPayment?.PaymentMethod?.QrCodeBase64;
        order.TicketUrl = firstPayment?.PaymentMethod?.TicketUrl;
        order.PixExpirationDate = isPix ? DateTimeOffset.UtcNow.AddMinutes(30) : null;

        if (firstPayment?.Status is "approved" || mpResponse.Status is "processed" or "approved")
        {
            order.Status = "approved";
            order.PaidAt = DateTimeOffset.UtcNow;
            order.TotalPaidAmount = totalAmount;
        }

        var savedOrder = await _orderRepository.CreateOrderAsync(order, cancellationToken);

        // Se o pagamento for instantâneo (cartão aprovado na criação), libera os créditos
        if (savedOrder is { Status: "approved", PlanId: not null })
        {
            await CreditTenantAsync(tenantId, savedOrder, plan, cancellationToken);
        }

        _logger.LogInformation(
            "Pedido {OrderId} persistido com status {Status} para o Tenant {TenantId}",
            savedOrder.Id, savedOrder.Status, tenantId);

        return mpResponse;
    }

    public async Task<MercadoPagoOrderResponse?> GetOrderStatusAsync(
        string paymentOrOrderId,
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        Order? order = null;

        if (Guid.TryParse(paymentOrOrderId, out var orderGuid))
        {
            order = await _orderRepository.GetOrderByIdAsync(orderGuid, tenantId, cancellationToken);
        }

        if (order is null)
        {
            order = await _orderRepository.GetOrderByMpPaymentIdAsync(paymentOrOrderId, cancellationToken);
            if (order is not null && order.TenantId != tenantId)
            {
                _logger.LogWarning(
                    "Violação de Tenant: Pedido {PaymentOrOrderId} acessado pelo Tenant {TenantId}",
                    paymentOrOrderId, tenantId);
                order = null; // Isolamento Multi-Tenant
            }
        }

        // Tenta também por ExternalReference caso o identificador informado seja a referência
        if (order is null)
        {
            var candidateOrder = await _orderRepository.GetOrderByExternalReferenceGlobalAsync(paymentOrOrderId, cancellationToken);
            if (candidateOrder is not null && candidateOrder.TenantId == tenantId)
            {
                order = candidateOrder;
            }
        }

        // Pattern matching lógico: evita reconsultar gateways se já finalizado
        if (order is { Status: "approved" or "rejected" })
        {
            return BuildOrderResponseFromOrder(order);
        }

        // Se o identificador passado for alfanumérico no formato PAY...,
        // a API do Mercado Pago recusa com 400 Bad Request. Retorna projeção local imediatamente.
        if (paymentOrOrderId.StartsWith("PAY", StringComparison.OrdinalIgnoreCase))
        {
            return order is not null ? BuildOrderResponseFromOrder(order) : null;
        }

        // 1. Consulta Order no Mercado Pago (se for compatível)
        var mpOrder = await _mercadoPagoGateway.GetOrderByIdAsync(paymentOrOrderId, cancellationToken);
        if (mpOrder is not null)
        {
            var isAccredited = mpOrder is { Status: "processed", StatusDetail: "accredited" };
            if (isAccredited && order is { Status: not "approved" })
            {
                await MarkOrderApprovedAndCreditAsync(order, tenantId, order.TotalAmount, cancellationToken);
            }

            return mpOrder;
        }

        // 2. Fallback para payments/{id} (apenas para IDs numéricos)
        if (long.TryParse(paymentOrOrderId, out _))
        {
            var mpPayment = await _mercadoPagoGateway.GetPaymentByIdAsync(paymentOrOrderId, cancellationToken);
            if (mpPayment is not null)
            {
                var isApproved = mpPayment.Status is "approved";
                if (isApproved && order is { Status: not "approved" })
                {
                    var paidAmount = mpPayment.TransactionAmount ?? order.TotalAmount;
                    await MarkOrderApprovedAndCreditAsync(order, tenantId, paidAmount, cancellationToken);
                }

                return ConvertPaymentToOrderResponse(mpPayment, order);
            }
        }

        return order is not null ? BuildOrderResponseFromOrder(order) : null;
    }

    public async Task<MercadoPagoOrderResponse?> GetOrderAsync(
        Guid id,
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        var order = await _orderRepository.GetOrderByIdAsync(id, tenantId, cancellationToken);
        if (order is null) return null;

        return BuildOrderResponseFromOrder(order);
    }

    #region Métodos Privados Auxiliares

    private async Task<User?> GetUserByEmailAsync(string? email, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(email)) return null;
        return await _userRepository.GetByEmailAsync(email, ct);
    }

    private static MercadoPagoPayerRequest BuildMercadoPagoPayer(
        User? user, 
        MercadoPagoPayerRequest? existingPayer,
        TenantBillingProfile? billingProfile)
    {
        var (firstName, lastName) = ExtractNames(existingPayer?.FirstName ?? billingProfile?.LegalName ?? user?.FullName);
        if (!string.IsNullOrWhiteSpace(existingPayer?.LastName))
        {
            lastName = existingPayer.LastName;
        }

        var docType = existingPayer?.Identification?.Type ?? billingProfile?.DocumentType ?? "CPF";
        var rawDoc = existingPayer?.Identification?.Number ?? billingProfile?.DocumentNumber ?? string.Empty;
        var cleanDoc = CleanDocumentSpan(rawDoc.AsSpan());

        var zipCode = existingPayer?.Address?.ZipCode ?? billingProfile?.ZipCode ?? "01001-000";
        var streetName = existingPayer?.Address?.StreetName ?? billingProfile?.StreetName ?? "Avenida Paulista";
        var streetNumber = existingPayer?.Address?.StreetNumber ?? billingProfile?.StreetNumber ?? "1000";
        var neighborhood = existingPayer?.Address?.Neighborhood ?? billingProfile?.Neighborhood ?? "Bela Vista";
        var city = existingPayer?.Address?.City ?? billingProfile?.City ?? "São Paulo";
        var federalUnit = existingPayer?.Address?.FederalUnit ?? billingProfile?.FederalUnit ?? "SP";
        var complement = existingPayer?.Address?.Complement ?? billingProfile?.Complement;

        return new MercadoPagoPayerRequest
        {
            Email = existingPayer?.Email ?? billingProfile?.Email ?? user?.Email ?? "financeiro@ecommercebot.local",
            FirstName = firstName,
            LastName = lastName,
            Identification = !string.IsNullOrWhiteSpace(cleanDoc)
                ? new MercadoPagoIdentificationRequest { Type = docType, Number = cleanDoc }
                : null,
            Address = new MercadoPagoAddressRequest
            {
                ZipCode = zipCode,
                StreetName = streetName,
                StreetNumber = streetNumber,
                Neighborhood = neighborhood,
                City = city,
                FederalUnit = federalUnit,
                Complement = complement
            }
        };
    }

    private static MercadoPagoOrderResponse BuildOrderResponseFromOrder(Order order)
    {
        var isApproved = string.Equals(order.Status, "approved", StringComparison.OrdinalIgnoreCase);
        var formattedTotal = order.TotalAmount.ToString("F2", CultureInfo.InvariantCulture);
        var formattedPaid = order.TotalPaidAmount.ToString("F2", CultureInfo.InvariantCulture);

        return new MercadoPagoOrderResponse
        {
            Id = order.MpPaymentId ?? order.Id.ToString(),
            Type = "online",
            ProcessingMode = "automatic",
            ExternalReference = order.ExternalReference,
            TotalAmount = formattedTotal,
            TotalPaidAmount = formattedPaid,
            Status = isApproved ? "processed" : (order.Status is "rejected" ? "failed" : "pending"),
            StatusDetail = isApproved ? "accredited" : "pending_waiting_transfer",
            CreatedDate = order.CreatedAt.ToString("o"),
            Transactions = new MercadoPagoOrderTransactionsResponse
            {
                Payments =
                [
                    new MercadoPagoOrderPaymentResponse
                    {
                        Id = order.MpPaymentId,
                        Amount = formattedTotal,
                        PaidAmount = formattedPaid,
                        Status = order.Status,
                        StatusDetail = isApproved ? "accredited" : "pending_waiting_transfer",
                        DateOfExpiration = order.PixExpirationDate?.ToString("o"),
                        PaymentMethod = new MercadoPagoOrderPaymentMethodResponse
                        {
                            Id = order.PaymentMethod,
                            Type = order.PaymentMethod == "pix" ? "bank_transfer" : "credit_card",
                            QrCode = order.PixQrCode,
                            QrCodeBase64 = order.PixQrCodeBase64,
                            TicketUrl = order.TicketUrl
                        }
                    }
                ]
            }
        };
    }

    private static MercadoPagoOrderResponse ConvertPaymentToOrderResponse(MercadoPagoPaymentResponse payment, Order? order)
    {
        var amount = payment.TransactionAmount?.ToString("F2", CultureInfo.InvariantCulture) ??
                     order?.TotalAmount.ToString("F2", CultureInfo.InvariantCulture) ?? "0.00";
        var isApproved = string.Equals(payment.Status, "approved", StringComparison.OrdinalIgnoreCase);

        return new MercadoPagoOrderResponse
        {
            Id = payment.Id?.ToString() ?? order?.MpPaymentId ?? order?.Id.ToString(),
            Type = "online",
            ProcessingMode = "automatic",
            ExternalReference = payment.ExternalReference ?? order?.ExternalReference,
            TotalAmount = amount,
            TotalPaidAmount = isApproved ? amount : "0.00",
            Status = isApproved ? "processed" : (payment.Status is "rejected" ? "failed" : "pending"),
            StatusDetail = payment.StatusDetail ?? (isApproved ? "accredited" : "pending"),
            CreatedDate = payment.DateApproved?.ToString("o") ?? order?.CreatedAt.ToString("o"),
            Transactions = new MercadoPagoOrderTransactionsResponse
            {
                Payments =
                [
                    new MercadoPagoOrderPaymentResponse
                    {
                        Id = payment.Id?.ToString(),
                        Amount = amount,
                        PaidAmount = isApproved ? amount : "0.00",
                        Status = payment.Status,
                        StatusDetail = payment.StatusDetail,
                        PaymentMethod = new MercadoPagoOrderPaymentMethodResponse
                        {
                            Id = payment.PaymentMethodId ?? order?.PaymentMethod,
                            Type = (payment.PaymentMethodId == "pix" || order?.PaymentMethod == "pix") ? "bank_transfer" : "credit_card",
                            QrCode = payment.PointOfInteraction?.TransactionData?.QrCode ?? order?.PixQrCode,
                            QrCodeBase64 = payment.PointOfInteraction?.TransactionData?.QrCodeBase64 ?? order?.PixQrCodeBase64,
                            TicketUrl = payment.PointOfInteraction?.TransactionData?.TicketUrl ?? order?.TicketUrl
                        }
                    }
                ]
            }
        };
    }

    /// <summary>
    /// Extrai Primeiro Nome e Sobrenome sem alocar arrays na Heap.
    /// </summary>
    private static (string FirstName, string LastName) ExtractNames(string? rawName)
    {
        if (string.IsNullOrWhiteSpace(rawName))
            return ("Cliente", "Cliente");

        var span = rawName.AsSpan().Trim();
        var spaceIndex = span.IndexOf(' ');

        if (spaceIndex < 0)
        {
            var single = span.ToString();
            return (single, single);
        }

        var first = span[..spaceIndex].Trim().ToString();
        var lastSpan = span[(spaceIndex + 1)..].Trim();
        var last = lastSpan.IsEmpty ? first : lastSpan.ToString();

        return (first, last);
    }

    /// <summary>
    /// Remove pontuações de documentos usando stackalloc buffer sem alocar strings intermediárias.
    /// </summary>
    private static string CleanDocumentSpan(ReadOnlySpan<char> document)
    {
        if (document.IsEmpty) return string.Empty;

        Span<char> buffer = stackalloc char[document.Length];
        var written = 0;

        for (var i = 0; i < document.Length; i++)
        {
            var c = document[i];
            if (char.IsLetterOrDigit(c))
            {
                buffer[written++] = c;
            }
        }

        return buffer[..written].ToString();
    }

    private async Task MarkOrderApprovedAndCreditAsync(
        Order order,
        Guid tenantId,
        decimal paidAmount,
        CancellationToken ct)
    {
        order.Status = "approved";
        order.PaidAt = DateTimeOffset.UtcNow;
        order.TotalPaidAmount = paidAmount;

        await _orderRepository.UpdateOrderAsync(order, ct);

        _logger.LogInformation(
            "Pedido {OrderId} aprovado com valor pago de {PaidAmount} para Tenant {TenantId}",
            order.Id, paidAmount, tenantId);

        if (order.PlanId.HasValue)
        {
            var plan = await _planRepository.GetByIdAsync(order.PlanId.Value, ct);
            await CreditTenantAsync(tenantId, order, plan, ct);
        }
    }

    private async Task CreditTenantAsync(
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

    private async Task<Plan?> ResolvePlanAsync(string planIdOrCode, CancellationToken ct)
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