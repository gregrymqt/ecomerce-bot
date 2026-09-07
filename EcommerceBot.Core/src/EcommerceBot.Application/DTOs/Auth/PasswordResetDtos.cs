using System;
using System.ComponentModel.DataAnnotations;

namespace EcommerceBot.Application.DTOs.Auth;

public sealed record ForgotPasswordRequest
{
    [Required(ErrorMessage = "O e-mail é obrigatório.")]
    [EmailAddress(ErrorMessage = "Informe um endereço de e-mail válido.")]
    public string Email { get; init; } = string.Empty;
}

public sealed record ResetPasswordRequest
{
    [Required(ErrorMessage = "O token de recuperação é obrigatório.")]
    public string Token { get; init; } = string.Empty;

    [Required(ErrorMessage = "A nova senha é obrigatória.")]
    [MinLength(6, ErrorMessage = "A senha deve conter no mínimo 6 caracteres.")]
    public string NewPassword { get; init; } = string.Empty;
}

public sealed record PasswordResetSession
{
    public Guid UserId { get; init; }
    public Guid TenantId { get; init; }
    public string Email { get; init; } = string.Empty;
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
}
