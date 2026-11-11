using System;
using System.Text;
using System.Threading.Tasks;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Infrastructure.Options;
using EcommerceBot.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;

namespace EcommerceBot.Infrastructure.Configurations;

/// <summary>
/// Configuração de autenticação JWT Bearer com suporte a cookies HttpOnly, blacklist no Redis e modo Fail-Closed.
/// </summary>
public static class JwtAuthExtensions
{
    public static IServiceCollection AddJwtAuthentication(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        var jwtOptions = configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
        var jwtKey = jwtOptions.Key;

        if (string.IsNullOrEmpty(jwtKey))
        {
            if (environment.IsDevelopment())
            {
                jwtKey = "DevOnly_EcommerceBotSecureSigningKey_Minimum32CharsLong!";
            }
            else
            {
                throw new InvalidOperationException("Jwt:Key is mandatory and must be configured in Production environment.");
            }
        }

        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(options =>
        {
            options.RequireHttpsMetadata = false;
            options.SaveToken = true;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                ValidateIssuer = true,
                ValidIssuer = jwtOptions.Issuer,
                ValidateAudience = true,
                ValidAudience = jwtOptions.Audience,
                ClockSkew = TimeSpan.Zero
            };
            options.Events = new JwtBearerEvents
            {
                OnMessageReceived = context =>
                {
                    if (string.IsNullOrWhiteSpace(context.Token))
                    {
                        var cookieToken = context.Request.Cookies["access_token"];
                        if (!string.IsNullOrWhiteSpace(cookieToken))
                        {
                            context.Token = cookieToken;
                        }
                    }

                    return Task.CompletedTask;
                },
                OnTokenValidated = async context =>
                {
                    var redisService = context.HttpContext.RequestServices.GetService<IRedisService>();
                    if (redisService == null)
                    {
                        return;
                    }

                    var rawFallback = AuthTokenHelper.ExtractBearerOrCookieToken(
                        context.Request.Headers.Authorization.ToString(),
                        context.Request.Cookies["access_token"]);

                    var revocationKey = AuthTokenHelper.ResolveValidationRevocationKey(
                        context.Principal,
                        context.SecurityToken,
                        rawFallback);

                    if (!string.IsNullOrEmpty(revocationKey) &&
                        await redisService.KeyExistsAsync(revocationKey, context.HttpContext.RequestAborted))
                    {
                        context.Fail("Token de acesso revogado.");
                    }
                }
            };
        });

        return services;
    }
}
