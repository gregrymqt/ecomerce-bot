using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Infrastructure.Options;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;

namespace EcommerceBot.Infrastructure.Services;

/// <summary>
/// Utilitários compartilhados de proteção CSRF (state nonce no Redis), validação de domínios Shopify,
/// verificação HMAC e resolução segura de URLs de frontend em fluxos OAuth.
/// </summary>
internal static partial class OAuthSecurityHelper
{
    private static readonly TimeSpan OAuthStateTtl = TimeSpan.FromMinutes(10);

    [GeneratedRegex(@"^[a-z0-9][a-z0-9\-]*\.myshopify\.com$", RegexOptions.Compiled | RegexOptions.CultureInvariant)]
    private static partial Regex ShopifyDomainRegex { get; }


    public static string GenerateNonce()
        => Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();

    public static async Task<string> CreateOAuthStateAsync<T>(
        IRedisService redisService,
        string platform,
        T payload,
        CancellationToken cancellationToken = default)
    {
        var nonce = GenerateNonce();
        var key = BuildOAuthStateKey(platform, nonce);
        await redisService.SetAsync(key, payload, OAuthStateTtl, cancellationToken);
        return nonce;
    }

    public static async Task<T?> ConsumeOAuthStateAsync<T>(
        IRedisService redisService,
        string platform,
        string? state,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(state))
        {
            return default;
        }

        var key = BuildOAuthStateKey(platform, state.Trim());
        var payload = await redisService.GetAsync<T>(key, cancellationToken);
        if (payload == null)
        {
            return default;
        }

        // Remoção atômica garante uso único (previne replay attacks)
        var deleted = await redisService.RemoveAsync(key, cancellationToken);
        return deleted ? payload : default;
    }

    public static bool TryNormalizeShopifyDomain(string? rawDomain, out string cleanDomain)
    {
        cleanDomain = string.Empty;
        if (string.IsNullOrWhiteSpace(rawDomain))
        {
            return false;
        }

        var candidate = rawDomain.Trim()
            .Replace("https://", string.Empty, StringComparison.OrdinalIgnoreCase)
            .Replace("http://", string.Empty, StringComparison.OrdinalIgnoreCase)
            .Split('/')[0]
            .Trim()
            .ToLowerInvariant();

        if (!ShopifyDomainRegex.IsMatch(candidate))
        {
            return false;
        }

        cleanDomain = candidate;
        return true;
    }

    /// <summary>
    /// Valida o parâmetro hmac do callback OAuth da Shopify segundo a especificação oficial:
    /// ordena todos os query params exceto hmac/signature e compara HMAC-SHA256 hex em tempo constante.
    /// </summary>
    public static bool VerifyShopifyQueryHmac(IQueryCollection query, string clientSecret, string? hmacQuery)
    {
        if (string.IsNullOrWhiteSpace(clientSecret) || string.IsNullOrWhiteSpace(hmacQuery))
        {
            return false;
        }

        var pairs = query
            .Where(kv => !string.Equals(kv.Key, "hmac", StringComparison.OrdinalIgnoreCase)
                      && !string.Equals(kv.Key, "signature", StringComparison.OrdinalIgnoreCase))
            .OrderBy(kv => kv.Key, StringComparer.Ordinal)
            .Select(kv => $"{EscapeShopifyHmacKey(kv.Key)}={EscapeShopifyHmacValue(kv.Value.ToString())}");

        var message = string.Join("&", pairs);
        var keyBytes = Encoding.UTF8.GetBytes(clientSecret);
        var messageBytes = Encoding.UTF8.GetBytes(message);

        using var hmac = new HMACSHA256(keyBytes);
        var computedHex = Convert.ToHexString(hmac.ComputeHash(messageBytes)).ToLowerInvariant();

        var computedBytes = Encoding.UTF8.GetBytes(computedHex);
        var providedBytes = Encoding.UTF8.GetBytes(hmacQuery.Trim().ToLowerInvariant());

        return computedBytes.Length == providedBytes.Length
            && CryptographicOperations.FixedTimeEquals(computedBytes, providedBytes);
    }

    public static string ResolveFrontendBaseUrl(AppOptions appOptions, IHostEnvironment environment)
    {
        var configuredUrl = appOptions.FrontendUrl?.Trim();
        var isLoopback = Uri.TryCreate(configuredUrl, UriKind.Absolute, out var feUri) && feUri.IsLoopback;

        if (!string.IsNullOrWhiteSpace(configuredUrl) && (environment.IsDevelopment() || !isLoopback))
        {
            return configuredUrl.TrimEnd('/');
        }

        return environment.IsDevelopment() ? "http://localhost:5173" : "https://app.ecommercebot.com";
    }

    private static string BuildOAuthStateKey(string platform, string state)
        => $"oauth:state:{platform.ToLowerInvariant()}:{state}";

    private static string EscapeShopifyHmacKey(string key)
        => key.Replace("%", "%25", StringComparison.Ordinal)
              .Replace("&", "%26", StringComparison.Ordinal)
              .Replace("=", "%3D", StringComparison.Ordinal);

    private static string EscapeShopifyHmacValue(string value)
        => value.Replace("%", "%25", StringComparison.Ordinal)
                .Replace("&", "%26", StringComparison.Ordinal);
}
