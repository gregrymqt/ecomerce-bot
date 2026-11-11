using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Auth;

namespace EcommerceBot.Application.Interfaces;

public interface IGoogleAuthService
{
    Task<string> GetGoogleAuthUrlAsync(string? state, CancellationToken cancellationToken = default);
    Task<AuthTokenResponse> AuthenticateGoogleUserAsync(GoogleCallbackRequest request);
}
