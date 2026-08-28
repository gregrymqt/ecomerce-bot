using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Infrastructure.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EcommerceBot.Infrastructure.Gateways
{
    public class ResendPermanentException : Exception
    {
        public int? StatusCode { get; }

        public ResendPermanentException(string message, int? statusCode = null) : base(message)
        {
            StatusCode = statusCode;
        }
    }

    public interface IResendGateway
    {
        Task<string?> SendEmailAsync(string to, string subject, string htmlContent, string? idempotencyKey);
    }

    public class ResendGateway : IResendGateway
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<ResendGateway> _logger;
        private readonly ResendOptions _resendOptions;

        public ResendGateway(HttpClient httpClient, IOptions<ResendOptions> resendOptions, ILogger<ResendGateway> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
            _resendOptions = resendOptions.Value;
        }

        public async Task<string?> SendEmailAsync(string to, string subject, string htmlContent, string? idempotencyKey)
        {
            var isMockMode = !_resendOptions.Enabled ||
                             string.Equals(_resendOptions.DeliveryMode, "Mock", StringComparison.OrdinalIgnoreCase) ||
                             string.Equals(_resendOptions.DeliveryMode, "LogOnly", StringComparison.OrdinalIgnoreCase) ||
                             string.IsNullOrWhiteSpace(_resendOptions.ApiKey) ||
                             _resendOptions.ApiKey == "re_test123";

            if (isMockMode)
            {
                var simulatedId = "simulated_" + Guid.NewGuid().ToString("N");
                _logger.LogInformation(
                    "[EMAIL SIMULATED] To: {To} | Subject: {Subject} | Mode: {Mode} | SimulatedId: {SimulatedId}",
                    to,
                    subject,
                    _resendOptions.DeliveryMode ?? "Mock",
                    simulatedId);

                return simulatedId;
            }

            try
            {
                var payload = new
                {
                    from = !string.IsNullOrWhiteSpace(_resendOptions.FromEmail)
                        ? _resendOptions.FromEmail
                        : "ECom AutoBot <notificacoes@ecommercebot.com>",
                    to = new[] { to },
                    subject = subject,
                    html = htmlContent
                };

                using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _resendOptions.ApiKey);
                if (!string.IsNullOrWhiteSpace(idempotencyKey))
                {
                    request.Headers.TryAddWithoutValidation("X-Entity-Ref-ID", idempotencyKey);
                }
                request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

                var response = await _httpClient.SendAsync(request);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    using var jsonDoc = JsonDocument.Parse(responseBody);
                    if (jsonDoc.RootElement.TryGetProperty("id", out var idProp))
                    {
                        return idProp.GetString();
                    }
                    return "resend_" + Guid.NewGuid().ToString("N");
                }

                // Trata erros da API do Resend
                var statusCodeInt = (int)response.StatusCode;
                var errorMessage = ExtractErrorMessage(responseBody, response.StatusCode);

                if (response.StatusCode == HttpStatusCode.Unauthorized ||
                    response.StatusCode == HttpStatusCode.Forbidden ||
                    response.StatusCode == HttpStatusCode.BadRequest ||
                    response.StatusCode == HttpStatusCode.UnprocessableEntity)
                {
                    // Erro permanente (ex: Domínio não verificado no DNS/Cloudflare, Chave inválida)
                    _logger.LogWarning(
                        "Resend API permanent rejection ({StatusCode}): {ErrorMessage} for recipient {To}",
                        statusCodeInt,
                        errorMessage,
                        to);

                    throw new ResendPermanentException(
                        $"Resend API Permanent Error ({statusCodeInt}): {errorMessage}",
                        statusCodeInt);
                }

                // Erros transitórios de rede/servidor (5xx, 429)
                _logger.LogError(
                    "Resend API transient failure ({StatusCode}): {ErrorMessage} for recipient {To}",
                    statusCodeInt,
                    errorMessage,
                    to);

                throw new HttpRequestException($"Resend API Error ({statusCodeInt}): {errorMessage}");
            }
            catch (ResendPermanentException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected exception while communicating with Resend for {To}", to);
                throw;
            }
        }

        private static string ExtractErrorMessage(string responseBody, HttpStatusCode statusCode)
        {
            if (string.IsNullOrWhiteSpace(responseBody))
            {
                return $"HTTP {statusCode}";
            }

            try
            {
                using var jsonDoc = JsonDocument.Parse(responseBody);
                if (jsonDoc.RootElement.TryGetProperty("message", out var msgProp))
                {
                    return msgProp.GetString() ?? responseBody;
                }
            }
            catch
            {
                // Corpo não é JSON válido
            }

            return responseBody;
        }
    }
}

