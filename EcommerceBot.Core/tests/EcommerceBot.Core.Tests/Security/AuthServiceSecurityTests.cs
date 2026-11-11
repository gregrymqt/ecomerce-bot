using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Net.Http;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Auth;
using EcommerceBot.Application.DTOs.Emails;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Application.Security;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Infrastructure.Configurations;
using EcommerceBot.Infrastructure.Options;
using EcommerceBot.Infrastructure.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace EcommerceBot.Core.Tests.Security;

public sealed class AuthServiceSecurityTests
{
    private static readonly JwtOptions TestJwtOptions = new()
    {
        Key = "SuperSecretTestSigningKeyAtLeast32CharsLong!",
        Issuer = "EcommerceBotApi",
        Audience = "EcommerceBotClient",
        ExpireMinutes = 60
    };

    private static AuthService CreateAuthService(
        InMemoryUserRepository userRepo,
        InMemoryTenantRepository tenantRepo,
        InMemoryRedisService redis,
        FakePublishEndpoint publishEndpoint,
        FakeWebHostEnvironment env,
        AppOptions? appOptions = null)
    {
        return new AuthService(
            userRepo,
            tenantRepo,
            redis,
            publishEndpoint,
            env,
            NullLogger<AuthService>.Instance,
            Options.Create(TestJwtOptions),
            Options.Create(new SecurityOptions()),
            Options.Create(appOptions ?? new AppOptions { FrontendUrl = "https://app.ecommercebot.com" }));
    }

    [Fact]
    public async Task RegisterUserAsync_IgnoresArbitraryTenantIdAndRoleJson_AndCreatesIsolatedTenant()
    {
        var userRepo = new InMemoryUserRepository();
        var tenantRepo = new InMemoryTenantRepository();
        var victimTenantId = Guid.NewGuid();
        tenantRepo.Tenants[victimTenantId] = new Tenant { Id = victimTenantId, Name = "Loja Vítima", IsActive = true };

        var service = CreateAuthService(
            userRepo,
            tenantRepo,
            new InMemoryRedisService(),
            new FakePublishEndpoint(),
            new FakeWebHostEnvironment { EnvironmentName = "Production" });

        // Simula payload de atacante tentando injetar tenantId de vítima e role ADMIN no JSON
        var attackerJson = $$"""
        {
            "email": "attacker@example.com",
            "password": "Password123!",
            "name": "Alice",
            "tenantName": "Minha Loja Isolada",
            "tenantId": "{{victimTenantId}}",
            "role": "ADMIN"
        }
        """;
        var request = JsonSerializer.Deserialize<CreateUserRequest>(
            attackerJson,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;

        var (user, accessToken) = await service.RegisterUserAsync(request);

        user.Tenants.Should().ContainSingle().Which.Should().NotBe(victimTenantId.ToString());
        user.Role.Should().Be("MEMBER");
        accessToken.Should().NotBeNullOrWhiteSpace();

        var createdTenantId = Guid.Parse(user.Tenants[0]);
        tenantRepo.Tenants.Should().ContainKey(createdTenantId);
        tenantRepo.Tenants[createdTenantId].Name.Should().Be("Minha Loja Isolada");
        tenantRepo.Transactions.Should().ContainSingle(t => t.TenantId == createdTenantId && t.Type == "WELCOME_BONUS");
    }

    [Fact]
    public async Task AuthenticateUserAsync_RejectsInactiveUser_AndInactiveTenant()
    {
        var userRepo = new InMemoryUserRepository();
        var tenantRepo = new InMemoryTenantRepository();
        var service = CreateAuthService(
            userRepo,
            tenantRepo,
            new InMemoryRedisService(),
            new FakePublishEndpoint(),
            new FakeWebHostEnvironment { EnvironmentName = "Production" });

        var inactiveUserTenantId = Guid.NewGuid();
        tenantRepo.Tenants[inactiveUserTenantId] = new Tenant { Id = inactiveUserTenantId, Name = "T1", IsActive = true };
        var inactiveUser = await userRepo.CreateAsync(new User
        {
            Email = "blocked@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Secret123!"),
            TenantId = inactiveUserTenantId,
            IsActive = false
        });

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            service.AuthenticateUserAsync(new LoginRequest { Email = inactiveUser.Email, Password = "Secret123!" }));

        var suspendedTenantId = Guid.NewGuid();
        tenantRepo.Tenants[suspendedTenantId] = new Tenant { Id = suspendedTenantId, Name = "T2", IsActive = false };
        var activeUserInSuspendedTenant = await userRepo.CreateAsync(new User
        {
            Email = "suspended@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Secret123!"),
            TenantId = suspendedTenantId,
            IsActive = true
        });

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            service.AuthenticateUserAsync(new LoginRequest { Email = activeUserInSuspendedTenant.Email, Password = "Secret123!" }));
    }

    [Fact]
    public async Task RevokeTokenAsync_BlacklistsJtiInRedis_AndJwtValidationRejectsRevokedOrForeignTokens()
    {
        var userRepo = new InMemoryUserRepository();
        var tenantRepo = new InMemoryTenantRepository();
        var redis = new InMemoryRedisService();
        var service = CreateAuthService(
            userRepo,
            tenantRepo,
            redis,
            new FakePublishEndpoint(),
            new FakeWebHostEnvironment { EnvironmentName = "Production" });

        var (userResp, token) = await service.RegisterUserAsync(new CreateUserRequest
        {
            Email = "logout-test@example.com",
            Password = "Password123!",
            Name = "Tester"
        });

        var parsed = new JwtSecurityTokenHandler().ReadJwtToken(token);
        var jti = parsed.Id;
        jti.Should().NotBeNullOrWhiteSpace();

        await service.RevokeTokenAsync(token);

        var (redisKey, _) = AuthTokenHelper.BuildRevocationEntry(token);
        (await redis.KeyExistsAsync(redisKey)).Should().BeTrue();

        // Verifica que JwtAuthExtensions exige Issuer e Audience válidos (Fail-Closed) e checa blacklist no Redis
        var services = new ServiceCollection();
        services.AddSingleton<IRedisService>(redis);
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:Key"] = TestJwtOptions.Key,
            ["Jwt:Issuer"] = TestJwtOptions.Issuer,
            ["Jwt:Audience"] = TestJwtOptions.Audience
        }).Build();
        services.AddJwtAuthentication(config, new FakeWebHostEnvironment { EnvironmentName = "Production" });
        using var provider = services.BuildServiceProvider();
        var jwtOptions = provider.GetRequiredService<IOptionsMonitor<JwtBearerOptions>>().Get(JwtBearerDefaults.AuthenticationScheme);

        jwtOptions.TokenValidationParameters.ValidateIssuer.Should().BeTrue();
        jwtOptions.TokenValidationParameters.ValidateAudience.Should().BeTrue();

        var scheme = new Microsoft.AspNetCore.Authentication.AuthenticationScheme("Bearer", null, typeof(JwtBearerHandler));

        // 1. Verifica que Query["access_token"] foi removida (OnMessageReceived não extrai token da URL)
        var httpContext = new DefaultHttpContext { RequestServices = provider };
        httpContext.Request.QueryString = new QueryString("?access_token=" + token);
        var msgContext = new MessageReceivedContext(httpContext, scheme, jwtOptions);
        await jwtOptions.Events.MessageReceived(msgContext);
        msgContext.Token.Should().BeNull();

        // 2. Verifica que OnTokenValidated falha quando jti está revogado no Redis
        var handler = new JwtSecurityTokenHandler();
        var principal = handler.ValidateToken(token, jwtOptions.TokenValidationParameters, out var validatedToken);
        var validatedContext = new TokenValidatedContext(httpContext, scheme, jwtOptions)
        {
            Principal = principal,
            SecurityToken = validatedToken
        };
        await jwtOptions.Events.TokenValidated(validatedContext);
        validatedContext.Result.Should().NotBeNull();
        validatedContext.Result!.Failure.Should().NotBeNull();
    }

    [Fact]
    public async Task ForgotPasswordAsync_IgnoresArbitraryOrigin_AndUsesConfiguredFrontendUrl()
    {
        var userRepo = new InMemoryUserRepository();
        var tenantRepo = new InMemoryTenantRepository();
        var publishEndpoint = new FakePublishEndpoint();
        var tenantId = Guid.NewGuid();
        tenantRepo.Tenants[tenantId] = new Tenant { Id = tenantId, Name = "Loja", IsActive = true };
        await userRepo.CreateAsync(new User
        {
            Email = "victim@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password123!"),
            TenantId = tenantId,
            IsActive = true
        });

        var service = CreateAuthService(
            userRepo,
            tenantRepo,
            new InMemoryRedisService(),
            publishEndpoint,
            new FakeWebHostEnvironment { EnvironmentName = "Production" },
            new AppOptions { FrontendUrl = "https://painel.ecommercebot.com" });

        await service.ForgotPasswordAsync("victim@example.com", "https://phishing.attacker.com");

        var sentEmail = publishEndpoint.PublishedMessages.OfType<EmailEventPayload>().Should().ContainSingle().Subject;
        var resetUrl = sentEmail.Data["resetUrl"].ToString()!;
        resetUrl.Should().StartWith("https://painel.ecommercebot.com/auth/reset-password?token=");
        resetUrl.Should().NotContain("attacker.com");
    }

    [Fact]
    public async Task GoogleAuthService_DisallowsMockModeInProduction()
    {
        var googleService = new GoogleAuthService(
            new InMemoryUserRepository(),
            new InMemoryTenantRepository(),
            new InMemoryRedisService(),
            new FakeWebHostEnvironment { EnvironmentName = "Production" },
            Options.Create(new GoogleAuthOptions { ClientId = "mock_client_id", ClientSecret = "mock_client_secret" }),
            Options.Create(TestJwtOptions),
            Options.Create(new SecurityOptions()),
            new HttpClient(new StubHttpMessageHandler(_ => new HttpResponseMessage(System.Net.HttpStatusCode.OK))),
            NullLogger<GoogleAuthService>.Instance);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            googleService.GetGoogleAuthUrlAsync(null));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            googleService.AuthenticateGoogleUserAsync(new GoogleCallbackRequest { Code = "fake-code", State = "fake-state" }));
    }

    [Fact]
    public async Task CorsExtensions_RestrictsLocalhostToDevelopmentOnly()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["App:FrontendUrl"] = "https://app.ecommercebot.com"
        }).Build();

        var prodServices = new ServiceCollection();
        prodServices.AddCorsConfiguration(config, new FakeWebHostEnvironment { EnvironmentName = "Production" });
        using var prodProvider = prodServices.BuildServiceProvider();
        var prodPolicy = await prodProvider.GetRequiredService<ICorsPolicyProvider>()
            .GetPolicyAsync(new DefaultHttpContext(), "DefaultCorsPolicy");

        prodPolicy!.Origins.Should().Contain("https://app.ecommercebot.com");
        prodPolicy.Origins.Should().NotContain(o => o.Contains("localhost", StringComparison.OrdinalIgnoreCase));

        var devServices = new ServiceCollection();
        devServices.AddCorsConfiguration(config, new FakeWebHostEnvironment { EnvironmentName = "Development" });
        using var devProvider = devServices.BuildServiceProvider();
        var devPolicy = await devProvider.GetRequiredService<ICorsPolicyProvider>()
            .GetPolicyAsync(new DefaultHttpContext(), "DefaultCorsPolicy");

        devPolicy!.Origins.Should().Contain("http://localhost:5173");
        devPolicy.Origins.Should().Contain("http://localhost:3000");
    }

    [Fact]
    public void TenantSessionScope_RestoresAmbientTenantOnDispose()
    {
        var outerTenant = Guid.NewGuid();
        var innerTenant = Guid.NewGuid();

        TenantSessionScope.CurrentTenantId.Should().BeNull();
        using (TenantSessionScope.BeginScope(outerTenant))
        {
            TenantSessionScope.CurrentTenantId.Should().Be(outerTenant);
            using (TenantSessionScope.BeginScope(innerTenant))
            {
                TenantSessionScope.CurrentTenantId.Should().Be(innerTenant);
            }
            TenantSessionScope.CurrentTenantId.Should().Be(outerTenant);
        }
        TenantSessionScope.CurrentTenantId.Should().BeNull();
    }
}
