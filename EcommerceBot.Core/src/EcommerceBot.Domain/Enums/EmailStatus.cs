namespace EcommerceBot.Domain.Enums;

/// <summary>
/// Ciclo de vida e status de entrega de notificações transacionais por e-mail via Resend Webhooks.
/// </summary>
public enum EmailStatus
{
    PENDING,
    QUEUED,
    SENT,
    DELIVERED,
    DELIVERY_DELAYED,
    COMPLAINED,
    BOUNCED,
    OPENED,
    CLICKED,
    FAILED,
    SIMULATED
}
