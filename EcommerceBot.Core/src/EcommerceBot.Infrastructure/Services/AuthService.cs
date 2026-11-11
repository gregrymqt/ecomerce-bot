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

namespace EcommerceBot.Infrastructure.Services;

public sealed class AuthService : IAuthService
{
        private readonly IUserRepository _userRepository;
        private readonly ITenantRepository _tenantRepository;
        private readonly IRedisService _redisService;
        private readonly IPublishEndpoint _publishEndpoint;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<AuthService> _logger;
        private readonly JwtOptions _jwtOptions;
        private readonly SecurityOptions _securityOptions;
        private readonly AppOptions _appOptions;

        public AuthService(
            IUserRepository userRepository, 
            ITenantRepository tenantRepository, 
            IRedisService redisService,
            IPublishEndpoint publishEndpoint,
            IWebHostEnvironment env,
            ILogger<AuthService> logger,
            IOptions<JwtOptions> jwtOptions,
            IOptions<SecurityOptions> securityOptions,
            IOptions<AppOptions> appOptions)
        {
            _userRepository = userRepository;
            _tenantRepository = tenantRepository;
            _redisService = redisService;
            _publishEndpoint = publishEndpoint;
            _env = env;
            _logger = logger;
            _jwtOptions = jwtOptions.Value;
            _securityOptions = securityOptions.Value;
            _appOptions = appOptions.Value;
        }

        private bool IsSuperAdminEmail(string? email) => AuthTokenHelper.IsSuperAdminEmail(email, _securityOptions);

        public async Task<(UserResponse User, string AccessToken)> RegisterUserAsync(CreateUserRequest request)
        {
            try
            {
                var existing = await _userRepository.GetByEmailAsync(request.Email);
                if (existing != null)
                    throw new InvalidOperationException("Email já cadastrado.");

                // Registro público sempre provisiona um Tenant próprio e isolado (previne Tenant Hijack)
                var tenantId = Guid.NewGuid();
                var tenantName = !string.IsNullOrWhiteSpace(request.TenantName)
                    ? request.TenantName.Trim()
                    : (!string.IsNullOrWhiteSpace(request.Name) ? $"Loja de {request.Name.Trim()}" : "Minha Loja");

                var newTenant = new Tenant
                {
                    Id = tenantId,
                    Name = tenantName,
                    PlanTier = "FREE",
                    CreditsBalance = 20, // 20 créditos bônus de boas-vindas
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

                // Registra o bônus inicial no Ledger de Créditos
                await _tenantRepository.RecordTransactionAsync(new CreditTransaction
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Amount = 20,
                    BalanceAfter = 20,
                    Type = "WELCOME_BONUS",
                    Description = "Bônus de boas-vindas (20 créditos de IA)",
                    CreatedAt = DateTimeOffset.UtcNow
                });

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
                var jwt = GenerateJwtToken(created, hasActiveCredits: true, creditsBalance: 20);

                var resp = new UserResponse
                {
                    Id = created.Id,
                    Email = created.Email,
                    Name = created.FullName,
                    Role = created.Role,
                    Tenants = new List<string> { created.TenantId.ToString() },
                    CreatedAt = created.CreatedAt,
                    CreditsBalance = 20,
                    HasActiveCredits = true
                };

                return (resp, jwt);
            }
            catch (UnauthorizedAccessException)
            {
                throw;
            }
            catch (InvalidOperationException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro no fluxo de registro do usuário para o email {Email}", request.Email);
                throw;
            }
        }

        public async Task<(UserResponse User, string AccessToken)> AuthenticateUserAsync(LoginRequest request)
        {
            try
            {
                var user = await _userRepository.GetByEmailAsync(request.Email.ToLower());
                if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
                {
                    throw new UnauthorizedAccessException("Credenciais inválidas.");
                }

                var tenant = await _tenantRepository.GetByIdAsync(user.TenantId);
                AuthTokenHelper.EnsureActiveUserAndTenant(user, tenant);

                // Sincroniza promoção automática caso o e-mail conste na variável de ambiente Security:SuperAdminEmails
                if (IsSuperAdminEmail(user.Email) && !string.Equals(user.Role, "ADMIN", StringComparison.OrdinalIgnoreCase))
                {
                    user.Role = "ADMIN";
                    await _userRepository.UpdateAsync(user);
                }

                var creditsBalance = tenant!.CreditsBalance;
                var hasActiveCredits = user.Role == "ADMIN" || creditsBalance > 0;

                var jwt = GenerateJwtToken(user, hasActiveCredits, creditsBalance);

                var resp = new UserResponse
                {
                    Id = user.Id,
                    Email = user.Email,
                    Name = user.FullName,
                    Role = user.Role,
                    Tenants = new List<string> { user.TenantId.ToString() },
                    CreatedAt = user.CreatedAt,
                    CreditsBalance = creditsBalance,
                    HasActiveCredits = hasActiveCredits
                };

                return (resp, jwt);
            }
            catch (UnauthorizedAccessException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro na autenticação do usuário para o email {Email}", request.Email);
                throw;
            }
        }

        private string GenerateJwtToken(User user, bool hasActiveCredits = false, int creditsBalance = 0)
            => AuthTokenHelper.GenerateJwtToken(user, _jwtOptions, hasActiveCredits, creditsBalance);

        public async Task<UserResponse> UpdateProfileAsync(Guid userId, UpdateUserRequest request)
        {
            try
            {
                var user = await _userRepository.GetByIdAsync(userId);
                if (user == null) throw new InvalidOperationException("Usuário não encontrado.");

                if (!string.IsNullOrEmpty(request.Name)) user.FullName = request.Name;
                if (!string.IsNullOrEmpty(request.Password)) user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
                // Role cannot be updated via standard user self-service profile update

                await _userRepository.UpdateAsync(user);

                var tenant = await _tenantRepository.GetByIdAsync(user.TenantId);
                AuthTokenHelper.EnsureActiveUserAndTenant(user, tenant);

                var creditsBalance = tenant!.CreditsBalance;
                var hasActiveCredits = user.Role == "ADMIN" || creditsBalance > 0;

                return new UserResponse
                {
                    Id = user.Id,
                    Email = user.Email,
                    Name = user.FullName,
                    Role = user.Role,
                    Tenants = new List<string> { user.TenantId.ToString() },
                    CreatedAt = user.CreatedAt,
                    CreditsBalance = creditsBalance,
                    HasActiveCredits = hasActiveCredits
                };
            }
            catch (UnauthorizedAccessException)
            {
                throw;
            }
            catch (InvalidOperationException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao atualizar perfil do usuário {UserId}", userId);
                throw;
            }
        }

        public async Task RevokeTokenAsync(string token)
        {
            if (string.IsNullOrWhiteSpace(token)) return;

            var (redisKey, ttl) = AuthTokenHelper.BuildRevocationEntry(token);
            await _redisService.SetAsync(redisKey, "revoked", ttl);
        }

        public async Task<AuthenticatedUser> ResolveUserActivePlanAsync(AuthenticatedUser currentUser, string? tenantId)
        {
            try
            {
                var result = currentUser;

                if (Guid.TryParse(currentUser.UserId, out var userId))
                {
                    var user = await _userRepository.GetByIdAsync(userId);
                    if (user != null)
                    {
                        result = result with
                        {
                            Name = user.FullName,
                            Email = user.Email,
                            Role = user.Role,
                            Tenants = new List<string> { user.TenantId.ToString() }
                        };

                        var targetTenantId = user.TenantId;
                        if (!string.IsNullOrEmpty(tenantId) && Guid.TryParse(tenantId, out var parsedTenantId))
                        {
                            targetTenantId = parsedTenantId;
                        }

                        var tenant = await _tenantRepository.GetByIdAsync(targetTenantId);
                        if (tenant != null)
                        {
                            var hasActiveCredits = user.Role == "ADMIN" || tenant.CreditsBalance > 0;
                            var plan = user.Role == "ADMIN" ? "admin" : (hasActiveCredits ? "active" : "free");

                            result = result with
                            {
                                CreditsBalance = tenant.CreditsBalance,
                                HasActiveCredits = hasActiveCredits,
                                Plan = plan
                            };
                        }
                    }
                }

                if (result.Role == "ADMIN")
                {
                    result = result with
                    {
                        HasActiveCredits = true,
                        Plan = "admin"
                    };
                }
                else if (string.IsNullOrEmpty(result.Plan))
                {
                    result = result with
                    {
                        Plan = result.HasActiveCredits ? "active" : "free"
                    };
                }

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao resolver plano ativo para o usuário {UserId}. Retornando snapshot atual.", currentUser.UserId);
                return currentUser;
            }
        }

        public async Task ForgotPasswordAsync(string email, string? clientOrigin = null)
        {
            if (string.IsNullOrWhiteSpace(email)) return;

            var normalizedEmail = email.Trim().ToLowerInvariant();

            try
            {
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

                // Fixa a URL base em App:FrontendUrl configurado no servidor (previne Password Reset Poisoning via headers)
                var configuredUrl = _appOptions.FrontendUrl?.Trim();
                var isLoopback = Uri.TryCreate(configuredUrl, UriKind.Absolute, out var feUri) && feUri.IsLoopback;
                var baseUrl = (!string.IsNullOrWhiteSpace(configuredUrl) && (_env.IsDevelopment() || !isLoopback))
                    ? configuredUrl.TrimEnd('/')
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
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro no fluxo de solicitação de recuperação de senha para o email {Email}", normalizedEmail);
                throw;
            }
        }

        public async Task<string> ResetPasswordAsync(ResetPasswordRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Token))
                throw new ArgumentException("O token de recuperação é obrigatório.");

            if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
                throw new ArgumentException("A nova senha deve conter no mínimo 6 caracteres.");

            try
            {
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
            catch (ArgumentException)
            {
                throw;
            }
            catch (UnauthorizedAccessException)
            {
                throw;
            }
            catch (InvalidOperationException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao redefinir senha do usuário com token de recuperação.");
                throw;
            }
        }

        public async Task<(UserResponse User, string AccessToken)> RefreshTokenAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            try
            {
                var user = await _userRepository.GetByIdAsync(userId);
                if (user == null || !user.IsActive)
                {
                    throw new InvalidOperationException("Usuário não encontrado ou inativo.");
                }

                if (IsSuperAdminEmail(user.Email) && !string.Equals(user.Role, "ADMIN", StringComparison.OrdinalIgnoreCase))
                {
                    user.Role = "ADMIN";
                    await _userRepository.UpdateAsync(user);
                }

                var tenant = await _tenantRepository.GetByIdAsync(user.TenantId);
                AuthTokenHelper.EnsureActiveUserAndTenant(user, tenant);

                var creditsBalance = tenant!.CreditsBalance;
                var hasActiveCredits = user.Role == "ADMIN" || creditsBalance > 0;

                var jwt = GenerateJwtToken(user, hasActiveCredits, creditsBalance);

                var resp = new UserResponse
                {
                    Id = user.Id,
                    Email = user.Email,
                    Name = user.FullName,
                    Role = user.Role,
                    Tenants = new List<string> { user.TenantId.ToString() },
                    CreatedAt = user.CreatedAt,
                    CreditsBalance = creditsBalance,
                    HasActiveCredits = hasActiveCredits
                };

                return (resp, jwt);
            }
            catch (UnauthorizedAccessException)
            {
                throw;
            }
            catch (InvalidOperationException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao renovar token/sessão para o usuário {UserId}", userId);
                throw;
            }
        }
    }
