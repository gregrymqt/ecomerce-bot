using System;
using System.Security.Claims;
using System.Threading.Tasks;
using EcommerceBot.Api.Filters;
using EcommerceBot.Application.DTOs.Auth;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/[controller]")]
public class AuthController : BaseApiController
{
    private readonly IAuthService _authService;
    private readonly IGoogleAuthService _googleAuthService;
    private readonly IEnterpriseLeadService _enterpriseLeadService;

    public AuthController(
        IAuthService authService,
        IGoogleAuthService googleAuthService,
        IEnterpriseLeadService enterpriseLeadService)
    {
        _authService = authService;
        _googleAuthService = googleAuthService;
        _enterpriseLeadService = enterpriseLeadService;
    }

    [HttpPost("register")]
    [AllowAnonymous]
    [RateLimit(MaxRequests = 10, WindowSeconds = 60, BlockDurationSeconds = 300)]
    public async Task<IActionResult> Register([FromBody] CreateUserRequest request)
    {
        try
        {
            var response = await _authService.RegisterUserAsync(request);
            return Created("", response);
        }
        catch (Exception ex)
        {
            return Conflict(new { Message = ex.Message });
        }
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [RateLimit(MaxRequests = 20, WindowSeconds = 60, BlockDurationSeconds = 300)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        try
        {
            var (user, token) = await _authService.AuthenticateUserAsync(request);

            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.None,
                MaxAge = TimeSpan.FromHours(2)
            };
            Response.Cookies.Append("access_token", token, cookieOptions);

            return Ok(user);
        }
        catch (Exception ex)
        {
            return Unauthorized(new { Message = ex.Message });
        }
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout()
    {
        var token = Request.Cookies["access_token"];
        if (!string.IsNullOrEmpty(token))
        {
            await _authService.RevokeTokenAsync(token);
        }

        Response.Cookies.Delete("access_token", new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None
        });

        return Ok(new { Message = "Logout realizado com sucesso." });
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMe([FromHeader(Name = "X-Tenant-ID")] string? tenantId)
    {
        var userId = CurrentUserId;
        if (userId == Guid.Empty) return Unauthorized();

        var authUser = new AuthenticatedUser
        {
            UserId = userId.ToString(),
            Email = CurrentUserEmail,
            Role = CurrentUserRole,
            IsAdmin = IsAdmin
        };

        var resolved = await _authService.ResolveUserActivePlanAsync(authUser, tenantId);
        return Ok(resolved);
    }

    [HttpPut("me")]
    public async Task<IActionResult> UpdateMe([FromBody] UpdateUserRequest request)
    {
        var userId = CurrentUserId;
        if (userId == Guid.Empty)
            return Unauthorized();

        var response = await _authService.UpdateProfileAsync(userId, request);
        return Ok(response);
    }

    [HttpGet("google/login")]
    [AllowAnonymous]
    public IActionResult GoogleLogin([FromQuery] string? state)
    {
        var url = _googleAuthService.GetGoogleAuthUrl(state);
        return Ok(new GoogleLoginUrlResponse { Url = url });
    }

    [HttpPost("google/callback")]
    [AllowAnonymous]
    public async Task<IActionResult> GoogleCallback([FromBody] GoogleCallbackRequest request)
    {
        try
        {
            var response = await _googleAuthService.AuthenticateGoogleUserAsync(request);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpPost("sso-enterprise/lead")]
    [AllowAnonymous]
    [RateLimit(MaxRequests = 10, WindowSeconds = 60, BlockDurationSeconds = 300)]
    public async Task<IActionResult> CreateEnterpriseLead([FromBody] EnterpriseLeadRequest request)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var response = await _enterpriseLeadService.RegisterLeadAsync(request, ip);
        return Created("", response);
    }
}
