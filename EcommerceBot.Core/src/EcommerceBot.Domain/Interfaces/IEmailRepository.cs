using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Enums;

namespace EcommerceBot.Domain.Interfaces;

/// <summary>
/// Contrato de persistência para trilhas de auditoria e status de entrega de e-mails transacionais (Resend).
/// </summary>
public interface IEmailRepository
{
    Task CreateEmailLogAsync(EmailLog log);
    Task UpdateEmailStatusByResendIdAsync(string resendId, EmailStatus status, string? error = null);
    Task<EmailLog?> GetEmailLogByResendIdAsync(string resendId);
}
