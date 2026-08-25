using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Auth;

namespace EcommerceBot.Application.Interfaces
{
    public interface IGoogleAuthService
    {
        string GetGoogleAuthUrl(string? state);
        Task<AuthTokenResponse> AuthenticateGoogleUserAsync(GoogleCallbackRequest request);
    }
}
