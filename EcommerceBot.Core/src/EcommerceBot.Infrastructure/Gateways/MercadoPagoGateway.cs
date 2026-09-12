using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.MercadoPago;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Infrastructure.Options;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EcommerceBot.Infrastructure.Gateways;

public sealed class MercadoPagoGateway : IMercadoPagoGateway
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<MercadoPagoGateway> _logger;
    private readonly MercadoPagoOptions _options;
    private readonly string _accessToken;
    private const string BaseUrl = "https://api.mercadopago.com";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    public MercadoPagoGateway(HttpClient httpClient, IOptions<MercadoPagoOptions> mercadoPagoOptions, ILogger<MercadoPagoGateway> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _options = mercadoPagoOptions.Value;
        _accessToken = _options.AccessToken ?? string.Empty;

        _httpClient.BaseAddress = new Uri(BaseUrl);
        _httpClient.DefaultRequestHeaders.Accept.Clear();
        _httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    public async Task<MercadoPagoOrderResponse> CreateOrderAsync(MercadoPagoOrderRequest request, string? idempotencyKey = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var key = string.IsNullOrWhiteSpace(idempotencyKey) ? Guid.NewGuid().ToString() : idempotencyKey;

            // Interceptação de e-mail de sandbox para atender à regra do Mercado Pago (invalid_email_for_sandbox)
            var isSandbox = _options.IsSandbox || _accessToken.StartsWith("TEST-", StringComparison.OrdinalIgnoreCase);
            var requestToSend = request;

            if (isSandbox && request.Payer != null)
            {
                var currentEmail = request.Payer.Email?.Trim() ?? string.Empty;
                if (!currentEmail.EndsWith("@testuser.com", StringComparison.OrdinalIgnoreCase))
                {
                    var sandboxEmail = !string.IsNullOrWhiteSpace(_options.SandboxPayerEmail)
                        ? _options.SandboxPayerEmail.Trim()
                        : "test_user_123456@testuser.com";

                    _logger.LogInformation(
                        "Mercado Pago Sandbox ativo. Interceptando e-mail do pagador para a API externa: de '{OriginalEmail}' para '{SandboxEmail}'. O banco de dados preserva o e-mail real.",
                        currentEmail, sandboxEmail);

                    requestToSend = request with
                    {
                        Payer = request.Payer with { Email = sandboxEmail }
                    };
                }
            }

            var jsonPayload = JsonSerializer.Serialize(requestToSend, JsonOptions);

            using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "/v1/orders")
            {
                Content = new StringContent(jsonPayload, Encoding.UTF8, "application/json")
            };

            httpRequest.Headers.Add("X-Idempotency-Key", key);
            if (!string.IsNullOrEmpty(_accessToken))
            {
                httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _accessToken);
            }

            _logger.LogInformation("Sending CreateOrder request to Mercado Pago. ExternalReference: {Ref}, IdempotencyKey: {Key}",
                request.ExternalReference, key);

            // Mock defensivo se chave não estiver configurada no ambiente local de dev
            if (string.IsNullOrEmpty(_accessToken) || _accessToken.StartsWith("APP_USR-seu-access-token"))
            {
                _logger.LogWarning("MercadoPago:AccessToken not configured or dummy. Returning simulated MercadoPagoOrderResponse.");
                return GenerateSimulatedOrderResponse(request);
            }

            var response = await _httpClient.SendAsync(httpRequest, cancellationToken);
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Mercado Pago CreateOrder failed with status {StatusCode}: {Body}", response.StatusCode, responseBody);
                throw new InvalidOperationException($"Erro ao criar pedido no Mercado Pago ({response.StatusCode}): {responseBody}");
            }

            var orderResponse = JsonSerializer.Deserialize<MercadoPagoOrderResponse>(responseBody, JsonOptions);
            return orderResponse ?? throw new InvalidOperationException("Falha ao desserializar resposta da API de Orders do Mercado Pago.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception when calling Mercado Pago CreateOrderAsync for ref {Ref}", request.ExternalReference);
            throw;
        }
    }

    public async Task<MercadoPagoOrderResponse?> GetOrderByIdAsync(string orderId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(orderId)) return null;

        // IDs que iniciam com PAY são transações de pagamento interno, não identificadores de Order
        if (orderId.StartsWith("PAY", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        try
        {
            using var httpRequest = new HttpRequestMessage(HttpMethod.Get, $"/v1/orders/{orderId}");
            if (!string.IsNullOrEmpty(_accessToken))
            {
                httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _accessToken);
            }

            if (string.IsNullOrEmpty(_accessToken) || _accessToken.StartsWith("APP_USR-seu-access-token"))
            {
                _logger.LogWarning("MercadoPago:AccessToken not configured. Returning simulated GetOrderById response for {Id}", orderId);
                return new MercadoPagoOrderResponse
                {
                    Id = orderId,
                    Status = "processed",
                    StatusDetail = "accredited",
                    Type = "online",
                    TotalAmount = "197.00",
                    TotalPaidAmount = "197.00"
                };
            }

            var response = await _httpClient.SendAsync(httpRequest, cancellationToken);
            if (response.StatusCode is System.Net.HttpStatusCode.NotFound or System.Net.HttpStatusCode.BadRequest)
            {
                _logger.LogWarning("Order {OrderId} não encontrada ou formato inválido na API do Mercado Pago (Status: {StatusCode}).", orderId, response.StatusCode);
                return null;
            }

            response.EnsureSuccessStatusCode();
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            return JsonSerializer.Deserialize<MercadoPagoOrderResponse>(responseBody, JsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get order {OrderId} from Mercado Pago", orderId);
            return null;
        }
    }

    public async Task<MercadoPagoPaymentResponse?> GetPaymentByIdAsync(string paymentId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(paymentId)) return null;

        // A rota /v1/payments/{id} do Mercado Pago aceita estritamente IDs numéricos
        if (paymentId.StartsWith("PAY", StringComparison.OrdinalIgnoreCase) || !long.TryParse(paymentId, out _))
        {
            return null;
        }

        try
        {
            using var httpRequest = new HttpRequestMessage(HttpMethod.Get, $"/v1/payments/{paymentId}");
            if (!string.IsNullOrEmpty(_accessToken))
            {
                httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _accessToken);
            }

            if (string.IsNullOrEmpty(_accessToken) || _accessToken.StartsWith("APP_USR-seu-access-token"))
            {
                _logger.LogWarning("MercadoPago:AccessToken not configured. Returning simulated GetPaymentById response for {Id}", paymentId);
                return new MercadoPagoPaymentResponse
                {
                    Id = paymentId,
                    Status = "approved",
                    StatusDetail = "accredited",
                    TransactionAmount = 197.00m,
                    DateApproved = DateTimeOffset.UtcNow
                };
            }

            var response = await _httpClient.SendAsync(httpRequest, cancellationToken);
            if (response.StatusCode is System.Net.HttpStatusCode.NotFound or System.Net.HttpStatusCode.BadRequest)
            {
                _logger.LogWarning("Payment {PaymentId} não encontrado ou inválido na API do Mercado Pago (Status: {StatusCode}).", paymentId, response.StatusCode);
                return null;
            }

            response.EnsureSuccessStatusCode();
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            return JsonSerializer.Deserialize<MercadoPagoPaymentResponse>(responseBody, JsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get payment {PaymentId} from Mercado Pago", paymentId);
            return null;
        }
    }

    public async Task<bool> RefundPaymentAsync(string paymentId, decimal? amount = null, CancellationToken cancellationToken = default)
    {
        try
        {
            using var httpRequest = new HttpRequestMessage(HttpMethod.Post, $"/v1/payments/{paymentId}/refunds");
            if (!string.IsNullOrEmpty(_accessToken))
            {
                httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _accessToken);
            }

            if (amount.HasValue && amount.Value > 0)
            {
                var payload = JsonSerializer.Serialize(new { amount = amount.Value.ToString("F2", System.Globalization.CultureInfo.InvariantCulture) });
                httpRequest.Content = new StringContent(payload, Encoding.UTF8, "application/json");
            }

            var response = await _httpClient.SendAsync(httpRequest, cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to refund payment {PaymentId} in Mercado Pago", paymentId);
            return false;
        }
    }

    private static MercadoPagoOrderResponse GenerateSimulatedOrderResponse(MercadoPagoOrderRequest request)
    {
        var isPix = request?.Transactions?.Payments?.Any(p =>
            string.Equals(p?.PaymentMethod?.Type, "pix", StringComparison.OrdinalIgnoreCase)) ?? false;

        var orderId = "ORD_SIM_" + Guid.NewGuid().ToString("N")[..12].ToUpper();
        var payId = "PAY_SIM_" + Guid.NewGuid().ToString("N")[..12].ToUpper();

        return new MercadoPagoOrderResponse
        {
            Id = orderId,
            Type = "online",
            ProcessingMode = "automatic",
            ExternalReference = request?.ExternalReference,
            TotalAmount = request?.TotalAmount,
            TotalPaidAmount = isPix ? "0.00" : request?.TotalAmount,
            Status = isPix ? "action_required" : "processed",
            StatusDetail = isPix ? "waiting_transfer" : "accredited",
            CreatedDate = DateTimeOffset.UtcNow.ToString("o"),
            CountryCode = "BR",
            CaptureMode = "automatic",
            Transactions = new MercadoPagoOrderTransactionsResponse
            {
                Payments =
                [
                    new()
                    {
                        Id = payId,
                        Amount = request?.TotalAmount,
                        PaidAmount = isPix ? "0.00" : request?.TotalAmount,
                        Status = isPix ? "action_required" : "processed",
                        StatusDetail = isPix ? "waiting_transfer" : "accredited",
                        PaymentMethod = new MercadoPagoOrderPaymentMethodResponse
                        {
                            Id = isPix ? "pix" : "visa",
                            Type = isPix ? "bank_transfer" : "credit_card",
                            QrCode = isPix ? "00020126580014br.gov.bcb.pix0136ecom-autobot-mp-pix-key-99182305204000053039865405149.005802BR5916ECOM AUTOBOT SAO PAULO6009SAO PAULO62070503***6304E8A2" : null,
                            QrCodeBase64 = isPix ? "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" : null,
                            TicketUrl = isPix ? "https://www.mercadopago.com.br/payments/ticket/simulated" : null
                        }
                    }
                ]
            }
        };
    }
}
