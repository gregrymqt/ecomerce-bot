using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.MercadoPago;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Infrastructure.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EcommerceBot.Infrastructure.Gateways;

public class MercadoPagoGateway : IMercadoPagoGateway
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<MercadoPagoGateway> _logger;
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
        _accessToken = mercadoPagoOptions.Value.AccessToken ?? string.Empty;

        _httpClient.BaseAddress = new Uri(BaseUrl);
        _httpClient.DefaultRequestHeaders.Accept.Clear();
        _httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    public async Task<MercadoPagoOrderResponse> CreateOrderAsync(MercadoPagoOrderRequest request, string? idempotencyKey = null)
    {
        try
        {
            var key = string.IsNullOrWhiteSpace(idempotencyKey) ? Guid.NewGuid().ToString() : idempotencyKey;
            var jsonPayload = JsonSerializer.Serialize(request, JsonOptions);
            
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

            var response = await _httpClient.SendAsync(httpRequest);
            var responseBody = await response.Content.ReadAsStringAsync();

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

    public async Task<MercadoPagoOrderResponse?> GetOrderByIdAsync(string orderId)
    {
        if (string.IsNullOrWhiteSpace(orderId)) return null;

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

            var response = await _httpClient.SendAsync(httpRequest);
            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                _logger.LogWarning("Order {OrderId} not found in Mercado Pago API.", orderId);
                return null;
            }

            response.EnsureSuccessStatusCode();
            var responseBody = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<MercadoPagoOrderResponse>(responseBody, JsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get order {OrderId} from Mercado Pago", orderId);
            return null;
        }
    }

    public async Task<MercadoPagoPaymentResponse?> GetPaymentByIdAsync(string paymentId)
    {
        if (string.IsNullOrWhiteSpace(paymentId)) return null;

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

            var response = await _httpClient.SendAsync(httpRequest);
            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                _logger.LogWarning("Payment {PaymentId} not found in Mercado Pago API.", paymentId);
                return null;
            }

            response.EnsureSuccessStatusCode();
            var responseBody = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<MercadoPagoPaymentResponse>(responseBody, JsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get payment {PaymentId} from Mercado Pago", paymentId);
            return null;
        }
    }

    public async Task<bool> RefundPaymentAsync(string paymentId, decimal? amount = null)
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

            var response = await _httpClient.SendAsync(httpRequest);
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
        var isPix = request.Transactions?.Payments?.PaymentMethod?.Id == "pix" || 
                    request.Transactions?.Payments?.PaymentMethod?.Type == "bank_transfer";

        var orderId = "ORD_SIM_" + Guid.NewGuid().ToString("N")[..12].ToUpper();
        var payId = "PAY_SIM_" + Guid.NewGuid().ToString("N")[..12].ToUpper();

        return new MercadoPagoOrderResponse
        {
            Id = orderId,
            Type = "online",
            ProcessingMode = "automatic",
            ExternalReference = request.ExternalReference,
            TotalAmount = request.TotalAmount,
            TotalPaidAmount = isPix ? "0.00" : request.TotalAmount,
            Status = isPix ? "action_required" : "processed",
            StatusDetail = isPix ? "waiting_transfer" : "accredited",
            CreatedDate = DateTimeOffset.UtcNow.ToString("o"),
            CountryCode = "BR",
            CaptureMode = "automatic",
            Transactions = new MercadoPagoOrderTransactionsResponse
            {
                Payments = new System.Collections.Generic.List<MercadoPagoOrderPaymentResponse>
                {
                    new()
                    {
                        Id = payId,
                        Amount = request.TotalAmount,
                        PaidAmount = isPix ? "0.00" : request.TotalAmount,
                        Status = isPix ? "action_required" : "processed",
                        StatusDetail = isPix ? "waiting_transfer" : "accredited",
                        PaymentMethod = new MercadoPagoOrderPaymentMethodResponse
                        {
                            Id = request.Transactions?.Payments?.PaymentMethod?.Id ?? (isPix ? "pix" : "visa"),
                            Type = request.Transactions?.Payments?.PaymentMethod?.Type ?? (isPix ? "bank_transfer" : "credit_card"),
                            QrCode = isPix ? "00020126580014br.gov.bcb.pix0136ecom-autobot-mp-pix-key-99182305204000053039865405149.005802BR5916ECOM AUTOBOT SAO PAULO6009SAO PAULO62070503***6304E8A2" : null,
                            QrCodeBase64 = isPix ? "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" : null,
                            TicketUrl = isPix ? "https://www.mercadopago.com.br/payments/ticket/simulated" : null
                        }
                    }
                }
            }
        };
    }
}
