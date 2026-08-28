using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Emails;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Application.ViewModels.Emails;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Enums;
using EcommerceBot.Domain.Interfaces;
using EcommerceBot.Infrastructure.Gateways;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Messaging
{
    public class EmailNotificationConsumer : IConsumer<EmailEventPayload>
    {
        private readonly IResendGateway _resendGateway;
        private readonly IEmailRepository _emailRepository;
        private readonly IRazorTemplateRenderer _templateRenderer;
        private readonly ILogger<EmailNotificationConsumer> _logger;

        public EmailNotificationConsumer(
            IResendGateway resendGateway,
            IEmailRepository emailRepository,
            IRazorTemplateRenderer templateRenderer,
            ILogger<EmailNotificationConsumer> logger)
        {
            _resendGateway = resendGateway;
            _emailRepository = emailRepository;
            _templateRenderer = templateRenderer;
            _logger = logger;
        }

        public async Task Consume(ConsumeContext<EmailEventPayload> context)
        {
            var payload = context.Message;
            _logger.LogInformation("Processando e-mail transacional para {Event} destinatário {Email}", payload.Event, payload.RecipientEmail);

            var (subject, html) = await ResolveEmailContentAsync(payload);

            try
            {
                var resendId = await _resendGateway.SendEmailAsync(
                    to: payload.RecipientEmail,
                    subject: subject,
                    htmlContent: html,
                    idempotencyKey: payload.IdempotencyKey
                );

                var isSimulated = !string.IsNullOrEmpty(resendId) && resendId.StartsWith("simulated_", StringComparison.OrdinalIgnoreCase);
                var status = isSimulated ? EmailStatus.SIMULATED.ToString() : EmailStatus.SENT.ToString();

                var log = new EmailLog
                {
                    TenantId = payload.TenantId,
                    ResendId = resendId,
                    Recipient = payload.RecipientEmail,
                    EventType = payload.Event,
                    Status = status,
                    Subject = subject,
                    IdempotencyKey = payload.IdempotencyKey,
                    MetadataInfo = JsonSerializer.Serialize(payload.Data)
                };

                await _emailRepository.CreateEmailLogAsync(log);
                _logger.LogInformation("E-mail processado com sucesso [{Status}]. ResendId={ResendId}, Evento={Event}", status, resendId, payload.Event);
            }
            catch (ResendPermanentException ex)
            {
                _logger.LogWarning("Falha permanente de envio no Resend para {Email} (Domínio/Configuração): {Error}", payload.RecipientEmail, ex.Message);
                var logError = new EmailLog
                {
                    TenantId = payload.TenantId,
                    Recipient = payload.RecipientEmail,
                    EventType = payload.Event,
                    Status = EmailStatus.FAILED.ToString(),
                    Subject = subject,
                    IdempotencyKey = payload.IdempotencyKey,
                    ErrorMessage = ex.Message,
                    MetadataInfo = JsonSerializer.Serialize(payload.Data)
                };
                await _emailRepository.CreateEmailLogAsync(logError);
                // Não re-lança exceção: evita re-tentativas desnecessárias e poluição de DLQ
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Falha transitória ao processar e-mail transacional para {Email}.", payload.RecipientEmail);
                var logError = new EmailLog
                {
                    TenantId = payload.TenantId,
                    Recipient = payload.RecipientEmail,
                    EventType = payload.Event,
                    Status = EmailStatus.FAILED.ToString(),
                    Subject = subject,
                    IdempotencyKey = payload.IdempotencyKey,
                    ErrorMessage = ex.Message,
                    MetadataInfo = JsonSerializer.Serialize(payload.Data)
                };
                await _emailRepository.CreateEmailLogAsync(logError);
                throw; // Aciona política de retry do MassTransit para falhas transitórias
            }
        }

        private async Task<(string Subject, string Html)> ResolveEmailContentAsync(EmailEventPayload payload)
        {
            var data = payload.Data ?? new Dictionary<string, object>();
            var recipientName = !string.IsNullOrWhiteSpace(payload.RecipientName) ? payload.RecipientName : "Cliente";

            try
            {
                switch (payload.Event.ToLowerInvariant())
                {
                    case "user.registered":
                    case "welcome":
                    {
                        var model = new WelcomeEmailViewModel
                        {
                            RecipientName = recipientName,
                            Email = payload.RecipientEmail,
                            LoginUrl = data.TryGetValue("loginUrl", out var lUrl) ? lUrl.ToString() ?? "https://app.ecommercebot.com/login" : "https://app.ecommercebot.com/login"
                        };
                        var html = await _templateRenderer.RenderViewToStringAsync("/Views/Emails/Welcome.cshtml", model);
                        return ("🚀 Bem-vindo ao E-commerce Bot!", html);
                    }

                    case "payment.approved":
                    {
                        var amountVal = data.TryGetValue("amount", out var a) && decimal.TryParse(a.ToString(), out var parsedA) ? parsedA : 0m;
                        var model = new PaymentApprovedEmailViewModel
                        {
                            RecipientName = recipientName,
                            PlanName = data.TryGetValue("planName", out var p) ? p.ToString() ?? "Assinatura Pro" : "Assinatura Pro",
                            Amount = amountVal,
                            PaymentMethod = data.TryGetValue("paymentMethod", out var pm) ? pm.ToString() ?? "PIX" : "PIX",
                            TransactionId = data.TryGetValue("resourceId", out var r) && r != null ? r.ToString()! : (payload.IdempotencyKey ?? string.Empty)
                        };
                        var html = await _templateRenderer.RenderViewToStringAsync("/Views/Emails/PaymentApproved.cshtml", model);
                        return ("✅ Pagamento Aprovado - E-commerce Bot", html);
                    }

                    case "wallet.low_balance":
                    {
                        var balanceVal = data.TryGetValue("currentBalance", out var cb) && decimal.TryParse(cb.ToString(), out var parsedCb) ? parsedCb : 0m;
                        var model = new LowBalanceEmailViewModel
                        {
                            RecipientName = recipientName,
                            CurrentBalance = balanceVal,
                            Threshold = 10.00m
                        };
                        var html = await _templateRenderer.RenderViewToStringAsync("/Views/Emails/LowBalance.cshtml", model);
                        return ("⚠️ Alerta de Saldo Baixo de IA - E-commerce Bot", html);
                    }

                    case "scraping.completed":
                    {
                        var total = data.TryGetValue("totalProducts", out var t) && int.TryParse(t.ToString(), out var pT) ? pT : 0;
                        var success = data.TryGetValue("successCount", out var s) && int.TryParse(s.ToString(), out var pS) ? pS : total;
                        var failed = data.TryGetValue("failedCount", out var f) && int.TryParse(f.ToString(), out var pF) ? pF : 0;

                        var model = new ScrapingCompletedEmailViewModel
                        {
                            RecipientName = recipientName,
                            TotalProducts = total,
                            SuccessCount = success,
                            FailedCount = failed
                        };
                        var html = await _templateRenderer.RenderViewToStringAsync("/Views/Emails/ScrapingCompleted.cshtml", model);
                        return ("📦 Extração de Produtos Concluída!", html);
                    }

                    case "integration.sync_failed":
                    {
                        var model = new SyncFailedEmailViewModel
                        {
                            RecipientName = recipientName,
                            PlatformName = data.TryGetValue("platform", out var pl) ? pl.ToString() ?? "Loja" : "Loja",
                            ErrorMessage = data.TryGetValue("errorMessage", out var err) ? err.ToString() ?? "Falha na comunicação de autenticação." : "Falha na comunicação de autenticação."
                        };
                        var html = await _templateRenderer.RenderViewToStringAsync("/Views/Emails/SyncFailed.cshtml", model);
                        return ("❌ Falha na Sincronização de Loja", html);
                    }

                    default:
                    {
                        string defaultSubject = $"Notificação: {payload.Event}";
                        string defaultHtml = $"<div style='font-family:sans-serif;background:#0f172a;color:#f8fafc;padding:32px;border-radius:8px;'><h2>Olá, {recipientName}</h2><p>Recebemos uma notificação para seu tenant sobre o evento <strong>{payload.Event}</strong>.</p></div>";
                        return (defaultSubject, defaultHtml);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Erro ao renderizar template Razor para evento {Event}. Utilizando fallback HTML.", payload.Event);
                string fallbackSubject = $"Atualização: {payload.Event}";
                string fallbackHtml = $"<div style='font-family:sans-serif;padding:24px;'><h2>Olá, {recipientName}</h2><p>Notificação de {payload.Event}.</p></div>";
                return (fallbackSubject, fallbackHtml);
            }
        }
    }
}
