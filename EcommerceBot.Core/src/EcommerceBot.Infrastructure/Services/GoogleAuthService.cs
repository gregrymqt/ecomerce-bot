using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Auth;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using EcommerceBot.Infrastructure.Options;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace EcommerceBot.Infrastructure.Services
{
    public class GoogleAuthService : IGoogleAuthService
    {
        private readonly IUserRepository _userRepository;
        private readonly ITenantRepository _tenantRepository;
        private readonly GoogleAuthOptions _googleOptions;
        private readonly JwtOptions _jwtOptions;
        private readonly HttpClient _httpClient;

        public GoogleAuthService(
            IUserRepository userRepository,
            ITenantRepository tenantRepository,
            IOptions<GoogleAuthOptions> googleOptions,
            IOptions<JwtOptions> jwtOptions,
            HttpClient httpClient)
        {
            _userRepository = userRepository;
            _tenantRepository = tenantRepository;
            _googleOptions = googleOptions.Value;
            _jwtOptions = jwtOptions.Value;
            _httpClient = httpClient;
        }

        public string GetGoogleAuthUrl(string? state)
        {
            var clientId = _googleOptions.ClientId;
            var redirectUri = _googleOptions.RedirectUri;
            return $"https://accounts.google.com/o/oauth2/v2/auth?client_id={clientId}&redirect_uri={redirectUri}&response_type=code&scope=openid%20email%20profile&access_type=offline&prompt=select_account{(state != null ? "&state=" + state : "")}";
        }

        public async Task<AuthTokenResponse> AuthenticateGoogleUserAsync(GoogleCallbackRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Code))
            {
                throw new ArgumentException("Código de autorização do Google é obrigatório.");
            }

            string email;
            string name;

            var isMockMode = string.IsNullOrWhiteSpace(_googleOptions.ClientId) ||
                             _googleOptions.ClientId.Contains("mock_") ||
                             string.IsNullOrWhiteSpace(_googleOptions.ClientSecret) ||
                             _googleOptions.ClientSecret.Contains("mock_");

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
                // Fluxo OAuth 2.0 Real do Google
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
                    throw new Exception($"Falha ao trocar código com o Google: {errorBody}");
                }

                var tokenJson = await tokenResponse.Content.ReadFromJsonAsync<JsonElement>();
                var googleAccessToken = tokenJson.GetProperty("access_token").GetString();

                // Busca dados do perfil do usuário no Google
                using var userInfoReq = new HttpRequestMessage(HttpMethod.Get, "https://www.googleapis.com/oauth2/v2/userinfo");
                userInfoReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", googleAccessToken);
                var userInfoRes = await _httpClient.SendAsync(userInfoReq);

                if (!userInfoRes.IsSuccessStatusCode)
                {
                    throw new Exception("Falha ao recuperar perfil do usuário no Google.");
                }

                var userInfoJson = await userInfoRes.Content.ReadFromJsonAsync<JsonElement>();
                email = userInfoJson.GetProperty("email").GetString()?.ToLowerInvariant() ?? throw new Exception("E-mail não fornecido pelo Google.");
                name = userInfoJson.TryGetProperty("name", out var nameProp) ? nameProp.GetString() ?? "Usuário Google" : "Usuário Google";
            }

            // Localiza ou cria o usuário e tenant no banco de dados
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
                    CreditsBalance = 10,
                    IsActive = true,
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                };
                await _tenantRepository.CreateAsync(newTenant);

                user = new User
                {
                    Email = email,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N")), // Senha aleatória segura
                    FullName = name,
                    Role = "MEMBER",
                    TenantId = tenantId
                };
                user = await _userRepository.CreateAsync(user);
            }

            var token = GenerateJwtToken(user);

            return new AuthTokenResponse
            {
                AccessToken = token,
                TokenType = "bearer",
                UserId = user.Id.ToString(),
                Email = user.Email,
                Name = user.FullName,
                Tenants = new List<string> { user.TenantId.ToString() },
                TenantId = user.TenantId.ToString()
            };
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
    }
}
