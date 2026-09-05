using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using System.Security.Cryptography;
using EcommerceBot.Application.DTOs.Auth;
using EcommerceBot.Application.DTOs.Emails;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using EcommerceBot.Infrastructure.Options;
using MassTransit;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using BCrypt.Net;

namespace EcommerceBot.Infrastructure.Services
{
    public class AuthService : IAuthService
    {
        private readonly IUserRepository _userRepository;
        private readonly ITenantRepository _tenantRepository;
        private readonly IRedisService _redisService;
        private readonly IPublishEndpoint _publishEndpoint;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<AuthService> _logger;
        private readonly JwtOptions _jwtOptions;
        private readonly SecurityOptions _securityOptions;

        public AuthService(
            IUserRepository userRepository, 
            ITenantRepository tenantRepository, 
            IRedisService redisService,
            IPublishEndpoint publishEndpoint,
            IWebHostEnvironment env,
            ILogger<AuthService> logger,
            IOptions<JwtOptions> jwtOptions,
            IOptions<SecurityOptions> securityOptions)
        {
            _userRepository = userRepository;
            _tenantRepository = tenantRepository;
            _redisService = redisService;
            _publishEndpoint = publishEndpoint;
            _env = env;
            _logger = logger;
            _jwtOptions = jwtOptions.Value;
            _securityOptions = securityOptions.Value;
        }

        private bool IsSuperAdminEmail(string? email)
        {
            if (string.IsNullOrWhiteSpace(_securityOptions.SuperAdminEmails) || string.IsNullOrWhiteSpace(email))
                return false;

            var adminEmails = _securityOptions.SuperAdminEmails
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            return adminEmails.Any(adminEmail => adminEmail.Equals(email.Trim(), StringComparison.OrdinalIgnoreCase));
        }

        public async Task<(UserResponse User, string AccessToken)> RegisterUserAsync(CreateUserRequest request)
        {
            var existing = await _userRepository.GetByEmailAsync(request.Email);
            if (existing != null)
                throw new Exception("Email já cadastrado.");

            var tenantId = Guid.NewGuid();
            if (Guid.TryParse(request.TenantId, out Guid parsedId))
            {
                tenantId = parsedId;
            }
            else
            {
                // Cria o Tenant para a nova conta com atribuição de primeiro toque
                var tenantName = !string.IsNullOrWhiteSpace(request.Name) ? $"Loja de {request.Name}" : "Minha Loja";
                var newTenant = new Tenant
                {
                    Id = tenantId,
                    Name = tenantName,
                    PlanTier = "FREE",
                    CreditsBalance = 10, // 10 créditos de boas-vindas
                    IsActive = true,
                    FirstUtmSource = request.UtmSource,
                    FirstUtmMedium = request.UtmMedium,
                    FirstUtmCampaign = request.UtmCampaign,
                    FirstAdId = request.AdId,
                    FirstTouchAt = DateTimeOffset.UtcNow,
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                };
                await _tenantRepository.CreateAsync(newTenant);
            }

            var isSuperAdmin = IsSuperAdminEmail(request.Email);
            var newUser = new User
            {
                Email = request.Email.ToLower(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                FullName = request.Name,
                Role = isSuperAdmin ? "ADMIN" : "MEMBER", // Auto-promove se constar em SuperAdminEmails, senão força MEMBER
                TenantId = tenantId
            };

            var created = await _userRepository.CreateAsync(newUser);
            var jwt = GenerateJwtToken(created);

            var resp = new UserResponse
            {
                Id = created.Id,
                Email = created.Email,
                Name = created.FullName,
                Role = created.Role,
                Tenants = new List<string> { created.TenantId.ToString() },
                CreatedAt = created.CreatedAt
            };

            return (resp, jwt);
        }

        public async Task<(UserResponse User, string AccessToken)> AuthenticateUserAsync(LoginRequest request)
        {
            var user = await _userRepository.GetByEmailAsync(request.Email.ToLower());
            if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            {
                throw new Exception("Credenciais inválidas.");
            }

            // Sincroniza promoção automática caso o e-mail conste na variável de ambiente Security:SuperAdminEmails
            if (IsSuperAdminEmail(user.Email) && !string.Equals(user.Role, "ADMIN", StringComparison.OrdinalIgnoreCase))
            {
                user.Role = "ADMIN";
                await _userRepository.UpdateAsync(user);
            }

            var jwt = GenerateJwtToken(user);

            var resp = new UserResponse
            {
                Id = user.Id,
                Email = user.Email,
                Name = user.FullName,
                Role = user.Role,
                Tenants = new List<string> { user.TenantId.ToString() },
                CreatedAt = user.CreatedAt
            };

            return (resp, jwt);
        }

        private string GenerateJwtToken(User user)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var keyStr = _jwtOptions.Key;
            if (string.IsNullOrWhiteSpace(keyStr))
            {
                throw new InvalidOperationException("Jwt:Key is required and must be configured in environment or appsettings.");
            }

            var key = Encoding.UTF8.GetBytes(keyStr);
            var expireMinutes = _jwtOptions.ExpireMinutes > 0 ? _jwtOptions.ExpireMinutes : 120;
            var descriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                    new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                    new Claim(JwtRegisteredClaimNames.Email, user.Email),
                    new Claim(ClaimTypes.Email, user.Email),
                    new Claim(ClaimTypes.Name, user.FullName ?? string.Empty),
                    new Claim("tenantId", user.TenantId.ToString()),
                    new Claim(ClaimTypes.Role, user.Role)
                }),
                Issuer = _jwtOptions.Issuer,
                Audience = _jwtOptions.Audience,
                Expires = DateTime.UtcNow.AddMinutes(expireMinutes),
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };
            var token = tokenHandler.CreateToken(descriptor);
            return tokenHandler.WriteToken(token);
        }

        public async Task<UserResponse> UpdateProfileAsync(Guid userId, UpdateUserRequest request)
        {
            var user = await _userRepository.GetByIdAsync(userId);
            if (user == null) throw new Exception("Usuário não encontrado.");

            if (!string.IsNullOrEmpty(request.Name)) user.FullName = request.Name;
            if (!string.IsNullOrEmpty(request.Password)) user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
            // Role cannot be updated via standard user self-service profile update

            await _userRepository.UpdateAsync(user);

            return new UserResponse
            {
                Id = user.Id,
                Email = user.Email,
                Name = user.FullName,
                Role = user.Role,
                Tenants = new List<string> { user.TenantId.ToString() },
                CreatedAt = user.CreatedAt
            };
        }

        public Task RevokeTokenAsync(string token)
        {
            // Revogação de Token geralmente envolve Redis blacklist
            return Task.CompletedTask;
        }

        public async Task<AuthenticatedUser> ResolveUserActivePlanAsync(AuthenticatedUser currentUser, string? tenantId)
        {
            if (Guid.TryParse(currentUser.UserId, out var userId))
            {
                var user = await _userRepository.GetByIdAsync(userId);
                if (user != null)
                {
                    currentUser.Name = user.FullName;
                    currentUser.Email = user.Email;
                    currentUser.Role = user.Role;
                    currentUser.Tenants = new List<string> { user.TenantId.ToString() };

                    var targetTenantId = user.TenantId;
                    if (!string.IsNullOrEmpty(tenantId) && Guid.TryParse(tenantId, out var parsedTenantId))
                    {
                        targetTenantId = parsedTenantId;
                    }

                    var tenant = await _tenantRepository.GetByIdAsync(targetTenantId);
                    if (tenant != null)
                    {
                        currentUser.Plan = user.Role == "ADMIN" ? "admin" : (tenant.PlanTier?.ToLowerInvariant() ?? "free");
                    }
                }
            }

            if (string.IsNullOrEmpty(currentUser.Plan))
            {
                currentUser.Plan = currentUser.Role == "ADMIN" ? "admin" : "free";
            }

            return currentUser;
        }

        public async Task ForgotPasswordAsync(string email, string? clientOrigin = null)
        {
            if (string.IsNullOrWhiteSpace(email)) return;

            var normalizedEmail = email.Trim().ToLowerInvariant();
            var user = await _userRepository.GetByEmailAsync(normalizedEmail);

            // Prevenção contra User Enumeration Attack: Resposta idêntica mesmo se usuário não existir
            if (user == null || !user.IsActive)
            {
                _logger.LogInformation("Password reset requested for non-existent or inactive email: {Email}", normalizedEmail);
                return;
            }

            // Geração de token criptograficamente seguro (32 bytes = 64 caracteres hexadecimais)
            var tokenBytes = RandomNumberGenerator.GetBytes(32);
            var token = Convert.ToHexString(tokenBytes).ToLowerInvariant();

            var session = new PasswordResetSession
            {
                UserId = user.Id,
                TenantId = user.TenantId,
                Email = user.Email,
                CreatedAt = DateTimeOffset.UtcNow
            };

            var redisKey = $"auth:password_reset:{token}";

            // TTL de 15 minutos estrito no Redis
            await _redisService.SetAsync(redisKey, session, TimeSpan.FromMinutes(15));

            var baseUrl = !string.IsNullOrWhiteSpace(clientOrigin)
                ? clientOrigin.TrimEnd('/')
                : (_env.IsDevelopment() ? "http://localhost:5173" : "https://app.ecommercebot.com");

            var resetUrl = $"{baseUrl}/auth/reset-password?token={token}";

            // Publica o evento assíncrono para envio de e-mail via MassTransit / Resend
            await _publishEndpoint.Publish(new EmailEventPayload
            {
                TenantId = user.TenantId,
                Event = "auth.password_reset",
                RecipientEmail = user.Email,
                RecipientName = user.FullName ?? "Usuário",
                IdempotencyKey = $"email:pwd_reset:{user.Id}:{DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 60}",
                Data = new Dictionary<string, object>
                {
                    { "resetUrl", resetUrl },
                    { "expiresInMinutes", 15 },
                    { "email", user.Email }
                }
            }, ctx =>
            {
                ctx.SetRoutingKey("email_notifications");
            });

            if (_env.IsDevelopment())
            {
                _logger.LogInformation("🔗 [DEV LOG] Link de redefinição de senha para {Email}: {ResetUrl}", user.Email, resetUrl);
            }
        }

        public async Task<string> ResetPasswordAsync(ResetPasswordRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Token))
                throw new ArgumentException("O token de recuperação é obrigatório.");

            if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
                throw new ArgumentException("A nova senha deve conter no mínimo 6 caracteres.");

            var redisKey = $"auth:password_reset:{request.Token.Trim()}";
            var session = await _redisService.GetAsync<PasswordResetSession>(redisKey);

            if (session == null || session.UserId == Guid.Empty)
                throw new ArgumentException("O link de recuperação é inválido ou expirou. Solicite um novo link.");

            var user = await _userRepository.GetByIdAsync(session.UserId);
            if (user == null || !user.IsActive)
                throw new InvalidOperationException("Usuário não encontrado ou inativo.");

            // Atualiza o hash da senha usando BCrypt Work Factor 12
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword, workFactor: 12);
            await _userRepository.UpdateAsync(user);

            // Destrói o token do Redis imediatamente (Proteção Single-Use)
            await _redisService.RemoveAsync(redisKey);

            _logger.LogInformation("Senha redefinida com sucesso para o usuário {UserId} ({Email})", user.Id, user.Email);

            return user.Email;
        }
    }
}
