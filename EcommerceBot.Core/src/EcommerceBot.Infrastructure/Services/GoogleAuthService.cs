using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Auth;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using EcommerceBot.Infrastructure.Options;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EcommerceBot.Infrastructure.Services;

public sealed class GoogleAuthService : IGoogleAuthService
{
        private readonly IUserRepository _userRepository;
        private readonly ITenantRepository _tenantRepository;
        private readonly IRedisService _redisService;
        private readonly IHostEnvironment _environment;
        private readonly GoogleAuthOptions _googleOptions;
        private readonly JwtOptions _jwtOptions;
        private readonly SecurityOptions _securityOptions;
        private readonly HttpClient _httpClient;
        private readonly ILogger<GoogleAuthService> _logger;

        public GoogleAuthService(
            IUserRepository userRepository,
            ITenantRepository tenantRepository,
            IRedisService redisService,
            IHostEnvironment environment,
            IOptions<GoogleAuthOptions> googleOptions,
            IOptions<JwtOptions> jwtOptions,
            IOptions<SecurityOptions> securityOptions,
            HttpClient httpClient,
            ILogger<GoogleAuthService> logger)
        {
            _userRepository = userRepository;
            _tenantRepository = tenantRepository;
            _redisService = redisService;
            _environment = environment;
            _googleOptions = googleOptions.Value;
            _jwtOptions = jwtOptions.Value;
            _securityOptions = securityOptions.Value;
            _httpClient = httpClient;
            _logger = logger;
        }

        private bool IsSuperAdminEmail(string? email) => AuthTokenHelper.IsSuperAdminEmail(email, _securityOptions);

        public async Task<string> GetGoogleAuthUrlAsync(string? state, CancellationToken cancellationToken = default)
        {
            var hasPlaceholderCreds = string.IsNullOrWhiteSpace(_googleOptions.ClientId)
                || _googleOptions.ClientId.Contains("mock_", StringComparison.OrdinalIgnoreCase);

            if (!_environment.IsDevelopment() && hasPlaceholderCreds)
            {
                throw new InvalidOperationException("Google OAuth ClientId não configurado para ambiente de produção.");
            }

            var effectiveState = !string.IsNullOrWhiteSpace(state)
                ? state.Trim()
                : OAuthSecurityHelper.GenerateNonce();

            await _redisService.SetAsync($"oauth:state:google:{effectiveState}", "1", TimeSpan.FromMinutes(10), cancellationToken);

            var clientId = Uri.EscapeDataString(_googleOptions.ClientId);
            var redirectUri = Uri.EscapeDataString(_googleOptions.RedirectUri);
            var escapedState = Uri.EscapeDataString(effectiveState);
            return $"https://accounts.google.com/o/oauth2/v2/auth?client_id={clientId}&redirect_uri={redirectUri}&response_type=code&scope=openid%20email%20profile&access_type=offline&prompt=select_account&state={escapedState}";
        }

        public async Task<AuthTokenResponse> AuthenticateGoogleUserAsync(GoogleCallbackRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Code))
            {
                throw new ArgumentException("Código de autorização do Google é obrigatório.");
            }

            var hasMockOrMissingCreds = string.IsNullOrWhiteSpace(_googleOptions.ClientId) ||
                             _googleOptions.ClientId.Contains("mock_", StringComparison.OrdinalIgnoreCase) ||
                             string.IsNullOrWhiteSpace(_googleOptions.ClientSecret) ||
                             _googleOptions.ClientSecret.Contains("mock_", StringComparison.OrdinalIgnoreCase);

            if (hasMockOrMissingCreds && !_environment.IsDevelopment())
            {
                throw new InvalidOperationException("Credenciais reais do Google OAuth são obrigatórias fora de Development.");
            }

            if (!string.IsNullOrWhiteSpace(request.State))
            {
                var consumed = await OAuthSecurityHelper.ConsumeOAuthStateAsync<string>(_redisService, "google", request.State);
                if (string.IsNullOrEmpty(consumed))
                {
                    throw new UnauthorizedAccessException("Estado OAuth do Google inválido ou expirado.");
                }
            }
            else if (!_environment.IsDevelopment())
            {
                throw new UnauthorizedAccessException("Parâmetro state OAuth do Google é obrigatório.");
            }

            string email;
            string name;

            var isMockMode = _environment.IsDevelopment() && hasMockOrMissingCreds;

            if (isMockMode)
            {
                // Modo simulado para desenvolvimento local sem necessidade de credenciais do Google Console
                var sanitizedCode = request.Code.Replace("-", "").Replace("_", "");
                var codeSuffix = sanitizedCode.Length >= 6 ? sanitizedCode.Substring(0, 6) : "dev";
                email = $"usuario.google.{codeSuffix}@ecommercebot.local";
                name = !string.IsNullOrWhiteSpace(request.TenantName) ? request.TenantName : "Usuário Google Dev";
            }
            else
            {
                try
                {
                    var tokenRequestParams = new Dictionary<string, string>
                    {
                        { "code", request.Code },
                        { "client_id", _googleOptions.ClientId },
                        { "client_secret", _googleOptions.ClientSecret },
                        { "redirect_uri", _googleOptions.RedirectUri },
                        { "grant_type", "authorization_code" }
                    };

                    var tokenResponse = await _httpClient.PostAsync("https://oauth2.googleapis.com/token", new FormUrlEncodedContent(tokenRequestParams));
                    if (!tokenResponse.IsSuccessStatusCode)
                    {
                        var errorBody = await tokenResponse.Content.ReadAsStringAsync();
                        _logger.LogError("Falha ao trocar código com o Google OAuth. StatusCode: {StatusCode}, Body: {ErrorBody}", tokenResponse.StatusCode, errorBody);
                        throw new InvalidOperationException($"Falha ao trocar código com o Google: {errorBody}");
                    }

                    var tokenJson = await tokenResponse.Content.ReadFromJsonAsync<JsonElement>();
                    var googleAccessToken = tokenJson.GetProperty("access_token").GetString();

                    // Busca dados do perfil do usuário no Google
                    using var userInfoReq = new HttpRequestMessage(HttpMethod.Get, "https://www.googleapis.com/oauth2/v2/userinfo");
                    userInfoReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", googleAccessToken);
                    var userInfoRes = await _httpClient.SendAsync(userInfoReq);

                    if (!userInfoRes.IsSuccessStatusCode)
                    {
                        var userInfoError = await userInfoRes.Content.ReadAsStringAsync();
                        _logger.LogError("Falha ao recuperar perfil do usuário no Google. StatusCode: {StatusCode}, Body: {ErrorBody}", userInfoRes.StatusCode, userInfoError);
                        throw new InvalidOperationException("Falha ao recuperar perfil do usuário no Google.");
                    }

                    var userInfoJson = await userInfoRes.Content.ReadFromJsonAsync<JsonElement>();
                    email = userInfoJson.GetProperty("email").GetString()?.ToLowerInvariant() ?? throw new InvalidOperationException("E-mail não fornecido pelo Google.");
                    name = userInfoJson.TryGetProperty("name", out var nameProp) ? nameProp.GetString() ?? "Usuário Google" : "Usuário Google";
                }
                catch (Exception ex) when (ex is not InvalidOperationException)
                {
                    _logger.LogError(ex, "Erro de rede/comunicação HTTP durante autenticação Google OAuth.");
                    throw new InvalidOperationException("Erro de conexão ao comunicar com os servidores do Google OAuth.", ex);
                }
            }

            // Localiza ou cria o usuário e tenant no banco de dados com logging estruturado
            try
            {
                var isSuperAdmin = IsSuperAdminEmail(email);
                var user = await _userRepository.GetByEmailAsync(email);
                if (user == null)
                {
                    var tenantId = Guid.NewGuid();
                    var tenantName = !string.IsNullOrWhiteSpace(request.TenantName) ? request.TenantName : $"Loja de {name}";
                    var newTenant = new Tenant
                    {
                        Id = tenantId,
                        Name = tenantName,
                        PlanTier = "FREE",
                        CreditsBalance = 20,
                        IsActive = true,
                        CreatedAt = DateTimeOffset.UtcNow,
                        UpdatedAt = DateTimeOffset.UtcNow
                    };
                    await _tenantRepository.CreateAsync(newTenant);

                    // Registra o bônus de boas-vindas no Ledger
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

                    user = new User
                    {
                        Email = email,
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N")), // Senha aleatória segura
                        FullName = name,
                        Role = isSuperAdmin ? "ADMIN" : "MEMBER",
                        TenantId = tenantId
                    };
                    user = await _userRepository.CreateAsync(user);
                    _logger.LogInformation("Novo usuário {Email} e Tenant {TenantId} provisionados via Google Auth.", email, tenantId);
                }
                else
                {
                    if (!user.IsActive)
                    {
                        throw new UnauthorizedAccessException("Conta de usuário desativada.");
                    }

                    if (isSuperAdmin && !string.Equals(user.Role, "ADMIN", StringComparison.OrdinalIgnoreCase))
                    {
                        user.Role = "ADMIN";
                        await _userRepository.UpdateAsync(user);
                        _logger.LogInformation("Usuário {Email} promovido para ADMIN via Google Auth.", email);
                    }
                }

                var tenant = await _tenantRepository.GetByIdAsync(user.TenantId);
                AuthTokenHelper.EnsureActiveUserAndTenant(user, tenant);

                var creditsBalance = tenant!.CreditsBalance;
                var hasActiveCredits = user.Role == "ADMIN" || creditsBalance > 0;

                var token = AuthTokenHelper.GenerateJwtToken(user, _jwtOptions, hasActiveCredits, creditsBalance);

                return new AuthTokenResponse
                {
                    AccessToken = token,
                    TokenType = "bearer",
                    UserId = user.Id.ToString(),
                    Email = user.Email,
                    Name = user.FullName,
                    Tenants = new List<string> { user.TenantId.ToString() },
                    TenantId = user.TenantId.ToString(),
                    CreditsBalance = creditsBalance,
                    HasActiveCredits = hasActiveCredits
                };
            }
            catch (UnauthorizedAccessException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao consultar ou persistir dados do usuário Google {Email}", email);
                throw;
            }
        }
    }
