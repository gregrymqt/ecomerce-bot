using System;
using System.ComponentModel.DataAnnotations;

namespace EcommerceBot.Application.DTOs.Auth
{
    public class ForgotPasswordRequest
    {
        [Required(ErrorMessage = "O e-mail é obrigatório.")]
        [EmailAddress(ErrorMessage = "Informe um endereço de e-mail válido.")]
        public string Email { get; set; } = string.Empty;
    }

    public class ResetPasswordRequest
    {
        [Required(ErrorMessage = "O token de recuperação é obrigatório.")]
        public string Token { get; set; } = string.Empty;

        [Required(ErrorMessage = "A nova senha é obrigatória.")]
        [MinLength(6, ErrorMessage = "A senha deve conter no mínimo 6 caracteres.")]
        public string NewPassword { get; set; } = string.Empty;
    }

    public class PasswordResetSession
    {
        public Guid UserId { get; set; }
        public Guid TenantId { get; set; }
        public string Email { get; set; } = string.Empty;
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    }
}
