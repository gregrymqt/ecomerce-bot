using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Auth;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using EcommerceBot.Infrastructure.Options;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using BCrypt.Net;

namespace EcommerceBot.Infrastructure.Services
{
    public class AuthService : IAuthService
    {
        private readonly IUserRepository _userRepository;
        private readonly ITenantRepository _tenantRepository;
        private readonly JwtOptions _jwtOptions;

        public AuthService(
            IUserRepository userRepository, 
            ITenantRepository tenantRepository, 
            IOptions<JwtOptions> jwtOptions)
        {
            _userRepository = userRepository;
            _tenantRepository = tenantRepository;
            _jwtOptions = jwtOptions.Value;
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

            var newUser = new User
            {
                Email = request.Email.ToLower(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                FullName = request.Name,
                Role = "MEMBER", // Enforce default MEMBER role to prevent privilege escalation
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
    }
}
