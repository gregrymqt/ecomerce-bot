using System;
using System.Threading.Tasks;

namespace EcommerceBot.Application.Interfaces;

/// <summary>
/// Contrato para disparo assíncrono de alertas e telemetria para canais do Discord via Webhooks.
/// </summary>
public interface IDiscordAlertService
{
    Task SendCriticalAlertAsync(string title, string description, Exception? exception = null, string? source = null);
    Task SendWarningAlertAsync(string title, string description, string? source = null);
    Task SendInfoAlertAsync(string title, string description, string? source = null);
}
