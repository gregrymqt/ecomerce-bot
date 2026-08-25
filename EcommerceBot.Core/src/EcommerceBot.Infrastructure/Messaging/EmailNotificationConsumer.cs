using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Emails;
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
        private readonly ILogger<EmailNotificationConsumer> _logger;

        public EmailNotificationConsumer(
            IResendGateway resendGateway,
            IEmailRepository emailRepository,
            ILogger<EmailNotificationConsumer> logger)
        {
            _resendGateway = resendGateway;
            _emailRepository = emailRepository;
            _logger = logger;
        }

        public async Task Consume(ConsumeContext<EmailEventPayload> context)
        {
            var payload = context.Message;
            _logger.LogInformation("Processing email notification for {Event} to {Email}", payload.Event, payload.RecipientEmail);

            // Resolução de template (Simulada)
            string subject = $"Atualização: {payload.Event}";
            string html = $"<h1>Olá, {payload.RecipientName}</h1><p>Notificação de {payload.Event}</p>";

            try
            {
                var resendId = await _resendGateway.SendEmailAsync(
                    to: payload.RecipientEmail,
                    subject: subject,
                    htmlContent: html,
                    idempotencyKey: payload.IdempotencyKey
                );

                var log = new EmailLog
                {
                    TenantId = payload.TenantId,
                    ResendId = resendId,
                    Recipient = payload.RecipientEmail,
                    EventType = payload.Event,
                    Status = EmailStatus.SENT.ToString(),
                    Subject = subject,
                    IdempotencyKey = payload.IdempotencyKey,
                    MetadataInfo = JsonSerializer.Serialize(payload.Data)
                };

                await _emailRepository.CreateEmailLogAsync(log);
            }
            catch (System.Exception ex)
            {
                _logger.LogError(ex, "Erro ao enviar e salvar email notification.");
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
                throw;
            }
        }
    }
}
