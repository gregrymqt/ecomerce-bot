using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Enums;

namespace EcommerceBot.Domain.Interfaces;

/// <summary>
/// Contrato de persistência para trilhas de auditoria e status de entrega de e-mails transacionais (Resend).
/// </summary>
public interface IEmailRepository
{
    Task CreateEmailLogAsync(EmailLog log, CancellationToken cancellationToken = default);
    Task UpdateEmailStatusByResendIdAsync(string resendId, EmailStatus status, string? error = null, CancellationToken cancellationToken = default);
    Task<EmailLog?> GetEmailLogByResendIdAsync(string resendId, CancellationToken cancellationToken = default);
}
