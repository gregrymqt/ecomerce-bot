using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using EcommerceBot.Application.DTOs.Auth;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;

namespace EcommerceBot.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class AuthController : ControllerBase
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

        [Authorize]
        [HttpGet("me")]
        public async Task<IActionResult> GetMe([FromHeader(Name = "X-Tenant-ID")] string? tenantId)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var authUser = new AuthenticatedUser
            {
                UserId = userId,
                Email = User.FindFirstValue(ClaimTypes.Email) ?? "",
                Role = User.FindFirstValue(ClaimTypes.Role) ?? "",
                IsAdmin = User.FindFirstValue(ClaimTypes.Role) == "ADMIN"
            };

            var resolved = await _authService.ResolveUserActivePlanAsync(authUser, tenantId);
            return Ok(resolved);
        }

        [Authorize]
        [HttpPut("me")]
        public async Task<IActionResult> UpdateMe([FromBody] UpdateUserRequest request)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out Guid userId))
                return Unauthorized();

            var response = await _authService.UpdateProfileAsync(userId, request);
            return Ok(response);
        }

        [HttpGet("google/login")]
        public IActionResult GoogleLogin([FromQuery] string? state)
        {
            var url = _googleAuthService.GetGoogleAuthUrl(state);
            return Ok(new GoogleLoginUrlResponse { Url = url });
        }

        [HttpPost("google/callback")]
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
        public async Task<IActionResult> CreateEnterpriseLead([FromBody] EnterpriseLeadRequest request)
        {
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            var response = await _enterpriseLeadService.RegisterLeadAsync(request, ip);
            return Created("", response);
        }
    }
}
