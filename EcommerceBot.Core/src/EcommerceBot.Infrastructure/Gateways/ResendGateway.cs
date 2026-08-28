using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Infrastructure.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EcommerceBot.Infrastructure.Gateways
{
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
            var apiKey = !string.IsNullOrWhiteSpace(_resendOptions.ApiKey) ? _resendOptions.ApiKey : "re_test123";
            _httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
        }

        public async Task<string?> SendEmailAsync(string to, string subject, string htmlContent, string? idempotencyKey)
        {
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

                var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

                // Em ambiente de desenvolvimento sem API key válida, fazemos um mock
                if (_resendOptions.ApiKey == "re_test123" || string.IsNullOrWhiteSpace(_resendOptions.ApiKey))
                {
                    _logger.LogInformation("Mocking Resend API call for {To}", to);
                    return "resend_" + System.Guid.NewGuid().ToString("N");
                }

                var response = await _httpClient.PostAsync("https://api.resend.com/emails", content);
                response.EnsureSuccessStatusCode();

                var responseBody = await response.Content.ReadAsStringAsync();
                using var jsonDoc = JsonDocument.Parse(responseBody);
                return jsonDoc.RootElement.GetProperty("id").GetString();
            }
            catch (System.Exception ex)
            {
                _logger.LogError(ex, "Failed to send email via Resend to {To}", to);
                throw;
            }
        }
    }
}
