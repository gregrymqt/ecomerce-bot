using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Auth;

namespace EcommerceBot.Application.Interfaces
{
    public interface IAuthService
    {
        Task<UserResponse> RegisterUserAsync(CreateUserRequest request);
        Task<(UserResponse User, string AccessToken)> AuthenticateUserAsync(LoginRequest request);
        Task<UserResponse> UpdateProfileAsync(Guid userId, UpdateUserRequest request);
        Task RevokeTokenAsync(string token);
        Task<AuthenticatedUser> ResolveUserActivePlanAsync(AuthenticatedUser currentUser, string? tenantId);
    }
}
