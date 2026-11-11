using System;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Infrastructure.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using JwtRegisteredClaimNames = System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames;

namespace EcommerceBot.Infrastructure.Services;

/// <summary>
/// Utilitários compartilhados de emissão, revogação e validação de ciclo de vida de JWT e contas ativas.
/// </summary>
internal static class AuthTokenHelper
{
    private const string RevokedJtiPrefix = "auth:revoked:jti:";
    private const string RevokedHashPrefix = "auth:revoked:sha256:";

    /// <summary>
    /// Verifica se o e-mail consta na allowlist de superadministradores configurada no servidor.
    /// </summary>
    public static bool IsSuperAdminEmail(string? email, SecurityOptions securityOptions)
    {
        if (string.IsNullOrWhiteSpace(securityOptions.SuperAdminEmails) || string.IsNullOrWhiteSpace(email))
            return false;

        var adminEmails = securityOptions.SuperAdminEmails
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        return adminEmails.Any(adminEmail => adminEmail.Equals(email.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// Garante que usuário e tenant existam e estejam ativos antes de emitir um novo token de sessão.
    /// </summary>
    public static void EnsureActiveUserAndTenant(User? user, Tenant? tenant)
    {
        if (user == null || !user.IsActive)
        {
            throw new UnauthorizedAccessException("Conta de usuário inativa ou não encontrada.");
        }

        if (tenant == null || !tenant.IsActive)
        {
            throw new UnauthorizedAccessException("Organização (tenant) desativada ou não encontrada.");
        }
    }

    /// <summary>
    /// Emite um JWT assinado com HMAC-SHA256 incluindo JTI único para suportar revogação no Redis.
    /// </summary>
    public static string GenerateJwtToken(User user, JwtOptions jwtOptions, bool hasActiveCredits = false, int creditsBalance = 0)
    {
        var keyStr = jwtOptions.Key;
        if (string.IsNullOrWhiteSpace(keyStr))
        {
            throw new InvalidOperationException("Jwt:Key is required and must be configured in environment or appsettings.");
        }

        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(keyStr);
        var expireMinutes = jwtOptions.ExpireMinutes > 0 ? jwtOptions.ExpireMinutes : 120;

        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Name, user.FullName ?? string.Empty),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
                new Claim("tenantId", user.TenantId.ToString()),
                new Claim(ClaimTypes.Role, user.Role),
                new Claim("hasActiveCredits", hasActiveCredits.ToString().ToLowerInvariant()),
                new Claim("creditsBalance", creditsBalance.ToString())
            }),
            Issuer = jwtOptions.Issuer,
            Audience = jwtOptions.Audience,
            Expires = DateTime.UtcNow.AddMinutes(expireMinutes),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(descriptor);
        return tokenHandler.WriteToken(token);
    }

    /// <summary>
    /// Calcula a chave de blacklist no Redis e o TTL restante a partir de um token JWT bruto.
    /// </summary>
    public static (string RedisKey, TimeSpan Ttl) BuildRevocationEntry(string rawToken)
    {
        var trimmed = rawToken.Trim();
        var handler = new JwtSecurityTokenHandler();

        if (handler.CanReadToken(trimmed))
        {
            var jwt = handler.ReadJwtToken(trimmed);
            var remaining = jwt.ValidTo - DateTime.UtcNow;
            var ttl = remaining > TimeSpan.FromSeconds(5) ? remaining : TimeSpan.FromMinutes(15);

            var key = !string.IsNullOrWhiteSpace(jwt.Id)
                ? $"{RevokedJtiPrefix}{jwt.Id}"
                : $"{RevokedHashPrefix}{ComputeSha256Hex(trimmed)}";

            return (key, ttl);
        }

        return ($"{RevokedHashPrefix}{ComputeSha256Hex(trimmed)}", TimeSpan.FromHours(2));
    }

    /// <summary>
    /// Resolve a chave de blacklist correspondente a um token recém-validado pelo middleware JwtBearer.
    /// </summary>
    public static string? ResolveValidationRevocationKey(ClaimsPrincipal? principal, SecurityToken? securityToken, string? rawTokenFallback)
    {
        var jti = principal?.FindFirst(JwtRegisteredClaimNames.Jti)?.Value;
        if (!string.IsNullOrWhiteSpace(jti))
        {
            return $"{RevokedJtiPrefix}{jti}";
        }

        var encodedToken = (securityToken as JsonWebToken)?.EncodedToken
            ?? (securityToken as JwtSecurityToken)?.RawData
            ?? rawTokenFallback;

        return !string.IsNullOrWhiteSpace(encodedToken)
            ? $"{RevokedHashPrefix}{ComputeSha256Hex(encodedToken.Trim())}"
            : null;
    }

    /// <summary>
    /// Extrai o token Bearer do cabeçalho Authorization ou do cookie HttpOnly access_token.
    /// </summary>
    public static string? ExtractBearerOrCookieToken(string? authorizationHeader, string? cookieToken)
    {
        if (!string.IsNullOrWhiteSpace(authorizationHeader) &&
            authorizationHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            var bearer = authorizationHeader["Bearer ".Length..].Trim();
            if (!string.IsNullOrWhiteSpace(bearer))
            {
                return bearer;
            }
        }

        return !string.IsNullOrWhiteSpace(cookieToken) ? cookieToken.Trim() : null;
    }

    private static string ComputeSha256Hex(string value)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
