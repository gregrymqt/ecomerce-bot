using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using EcommerceBot.Application.DTOs.Auth;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using BCrypt.Net;

namespace EcommerceBot.Infrastructure.Services
{
    public class AuthService : IAuthService
    {
        private readonly IUserRepository _userRepository;
        private readonly ITenantRepository _tenantRepository;
        private readonly IConfiguration _configuration;

        public AuthService(IUserRepository userRepository, ITenantRepository tenantRepository, IConfiguration configuration)
        {
            _userRepository = userRepository;
            _tenantRepository = tenantRepository;
            _configuration = configuration;
        }

        public async Task<UserResponse> RegisterUserAsync(CreateUserRequest request)
        {
            var existing = await _userRepository.GetByEmailAsync(request.Email);
            if (existing != null)
                throw new Exception("Email já cadastrado.");

            var tenantId = Guid.NewGuid();
            if (Guid.TryParse(request.TenantId, out Guid parsedId))
            {
                tenantId = parsedId;
            }
            // In a real app we'd verify the Tenant exists or create one here.

            var newUser = new User
            {
                Email = request.Email.ToLower(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                FullName = request.Name,
                Role = string.IsNullOrEmpty(request.Role) ? "MEMBER" : request.Role,
                TenantId = tenantId
            };

            var created = await _userRepository.CreateAsync(newUser);

            return new UserResponse
            {
                Id = created.Id,
                Email = created.Email,
                Name = created.FullName,
                Role = created.Role,
                Tenants = new List<string> { created.TenantId.ToString() },
                CreatedAt = created.CreatedAt
            };
        }

        public async Task<(UserResponse User, string AccessToken)> AuthenticateUserAsync(LoginRequest request)
        {
            var user = await _userRepository.GetByEmailAsync(request.Email.ToLower());
            if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            {
                throw new Exception("Credenciais inválidas.");
            }

            var tokenHandler = new JwtSecurityTokenHandler();
            var keyStr = _configuration["Jwt:Key"] ?? "MinhaChaveSuperSecretaGigante123!";
            var key = Encoding.UTF8.GetBytes(keyStr);
            var descriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                    new Claim(JwtRegisteredClaimNames.Email, user.Email),
                    new Claim("tenantId", user.TenantId.ToString()),
                    new Claim(ClaimTypes.Role, user.Role)
                }),
                Expires = DateTime.UtcNow.AddHours(2),
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };
            var token = tokenHandler.CreateToken(descriptor);
            var jwt = tokenHandler.WriteToken(token);

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

        public async Task<UserResponse> UpdateProfileAsync(Guid userId, UpdateUserRequest request)
        {
            var user = await _userRepository.GetByIdAsync(userId);
            if (user == null) throw new Exception("Usuário não encontrado.");

            if (!string.IsNullOrEmpty(request.Name)) user.FullName = request.Name;
            if (!string.IsNullOrEmpty(request.Password)) user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
            if (!string.IsNullOrEmpty(request.Role)) user.Role = request.Role;

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

        public Task<AuthenticatedUser> ResolveUserActivePlanAsync(AuthenticatedUser currentUser, string? tenantId)
        {
            currentUser.Plan = currentUser.Role == "ADMIN" ? "admin" : "free";
            return Task.FromResult(currentUser);
        }
    }
}
