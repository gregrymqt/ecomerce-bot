using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Infrastructure.Options;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EcommerceBot.Infrastructure.Services;

/// <summary>
/// Serviço de envio de alertas em tempo real para o canal de monitoramento do Discord via Webhooks.
/// </summary>
public class DiscordAlertService : IDiscordAlertService
{
    private readonly HttpClient _httpClient;
    private readonly DiscordOptions _discordOptions;
    private readonly IHostEnvironment _environment;
    private readonly ILogger<DiscordAlertService> _logger;

    private const int ColorCritical = 0xEF4444; // Vermelho
    private const int ColorWarning = 0xF59E0B;  // Amarelo
    private const int ColorInfo = 0x10B981;     // Verde

    public DiscordAlertService(
        HttpClient httpClient,
        IOptions<DiscordOptions> discordOptions,
        IHostEnvironment environment,
        ILogger<DiscordAlertService> logger)
    {
        _httpClient = httpClient;
        _discordOptions = discordOptions.Value;
        _environment = environment;
        _logger = logger;
    }

    public async Task SendCriticalAlertAsync(string title, string description, Exception? exception = null, string? source = null)
    {
        var fields = new List<object>();

        if (!string.IsNullOrWhiteSpace(source))
        {
            fields.Add(new { name = "Origem", value = source, inline = true });
        }

        fields.Add(new { name = "Ambiente", value = _environment.EnvironmentName.ToUpper(), inline = true });

        if (exception != null)
        {
            var stackTrace = exception.ToString();
            if (stackTrace.Length > 1000)
            {
                stackTrace = stackTrace.Substring(0, 1000) + "... [truncado]";
            }

            fields.Add(new { name = "Exceção", value = $"```{stackTrace}```", inline = false });
        }

        await SendEmbedAsync(
            title: $"🚨 [FALHA CRÍTICA] {title}",
            description: description,
            color: ColorCritical,
            fields: fields
        );
    }

    public async Task SendWarningAlertAsync(string title, string description, string? source = null)
    {
        var fields = new List<object>
        {
            new { name = "Ambiente", value = _environment.EnvironmentName.ToUpper(), inline = true }
        };

        if (!string.IsNullOrWhiteSpace(source))
        {
            fields.Add(new { name = "Origem", value = source, inline = true });
        }

        await SendEmbedAsync(
            title: $"⚠️ [ALERTA] {title}",
            description: description,
            color: ColorWarning,
            fields: fields
        );
    }

    public async Task SendInfoAlertAsync(string title, string description, string? source = null)
    {
        var fields = new List<object>
        {
            new { name = "Ambiente", value = _environment.EnvironmentName.ToUpper(), inline = true }
        };

        if (!string.IsNullOrWhiteSpace(source))
        {
            fields.Add(new { name = "Origem", value = source, inline = true });
        }

        await SendEmbedAsync(
            title: $"ℹ️ [INFO] {title}",
            description: description,
            color: ColorInfo,
            fields: fields
        );
    }

    private async Task SendEmbedAsync(string title, string description, int color, List<object> fields)
    {
        if (string.IsNullOrWhiteSpace(_discordOptions.WebhookUrl) || !_discordOptions.Enabled)
        {
            return;
        }

        try
        {
            var payload = new
            {
                username = "E-commerce Bot Sentinel",
                avatar_url = "https://cdn-icons-png.flaticon.com/512/4712/4712035.png",
                embeds = new[]
                {
                    new
                    {
                        title = title.Length > 250 ? title.Substring(0, 250) : title,
                        description = description.Length > 2000 ? description.Substring(0, 2000) : description,
                        color = color,
                        fields = fields,
                        timestamp = DateTime.UtcNow.ToString("o"),
                        footer = new
                        {
                            text = "EcommerceBot Observability & Alerting"
                        }
                    }
                }
            };

            var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync(_discordOptions.WebhookUrl, content);

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Discord Webhook retornou status {StatusCode}: {Body}", response.StatusCode, body);
            }
        }
        catch (Exception ex)
        {
            // Falhas de alerta no Discord nunca devem quebrar o fluxo principal da requisição
            _logger.LogWarning(ex, "Falha ao enviar alerta para o Discord Webhook.");
        }
    }
}
