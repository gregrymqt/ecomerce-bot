using System;
using System.Collections.Generic;
using System.IO;
using Microsoft.Extensions.Configuration;

namespace EcommerceBot.Infrastructure.Configurations;

/// <summary>
/// Provedor nativo em C# para localização, leitura e injeção de variáveis de arquivo .env no ecossistema .NET.
/// Suporta resolução recursiva de caminho, mapeamento hierárquico (Secao__Chave -> Secao:Chave) e tabela de aliases.
/// </summary>
public static class DotEnvConfigurationExtensions
{
    private static readonly Dictionary<string, string> StandardAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        { "JWT_SECRET_KEY", "Jwt:Key" },
        { "ACCESS_TOKEN_EXPIRE_MINUTES", "Jwt:ExpireMinutes" },
        { "MSSQL_CONNECTION_STRING", "ConnectionStrings:DefaultConnection" },
        { "REDIS_URL", "Redis:ConnectionString" },
        { "REDIS_PASSWORD", "Redis:Password" },
        { "AES_MASTER_KEY", "Security:AesMasterKey" },
        { "ADMIN_EMAILS", "Security:SuperAdminEmails" },
        { "MERCADOPAGO_ACCESS_TOKEN", "MercadoPago:AccessToken" },
        { "MERCADOPAGO_WEBHOOK_SECRET", "MercadoPago:WebhookSecret" },
        { "MERCADOPAGO_PUBLIC_KEY", "MercadoPago:PublicKey" },
        { "RESEND_API_KEY", "Resend:ApiKey" },
        { "RESEND_WEBHOOK_SECRET", "Resend:WebhookSecret" },
        { "RESEND_DELIVERY_MODE", "Resend:DeliveryMode" },
        { "RESEND_ENABLED", "Resend:Enabled" },
        { "EMAIL_FROM", "Resend:FromEmail" },
        { "SHOPIFY_CLIENT_ID", "Shopify:ClientId" },
        { "SHOPIFY_CLIENT_SECRET", "Shopify:ClientSecret" },
        { "SHOPIFY_WEBHOOK_SECRET", "Shopify:WebhookSecret" },
        { "SHOPIFY_SCOPES", "Shopify:Scopes" },
        { "SHOPIFY_REDIRECT_URI", "Shopify:RedirectUri" },
        { "SHOPIFY_API_VERSION", "Shopify:ApiVersion" },
        { "SHOPIFY_APP_URL", "Shopify:AppUrl" },
        { "NUVEMSHOP_CLIENT_ID", "Nuvemshop:ClientId" },
        { "NUVEMSHOP_CLIENT_SECRET", "Nuvemshop:ClientSecret" },
        { "NUVEMSHOP_WEBHOOK_SECRET", "Nuvemshop:WebhookSecret" },
        { "NUVEMSHOP_REDIRECT_URI", "Nuvemshop:RedirectUri" },
        { "NUVEMSHOP_WEBHOOK_CALLBACK_URL", "Nuvemshop:WebhookCallbackUrl" },
        { "NUVEMSHOP_SCOPES", "Nuvemshop:Scopes" },
        { "GOOGLE_CLIENT_ID", "Google:ClientId" },
        { "GOOGLE_CLIENT_SECRET", "Google:ClientSecret" },
        { "GOOGLE_REDIRECT_URI", "Google:RedirectUri" },
        { "DISCORD_WEBHOOK_URL", "Discord:WebhookUrl" },
        { "PUBLIC_BASE_URL", "App:BaseUrl" },
        { "FRONTEND_URL", "App:FrontendUrl" }
    };

    public static IConfigurationBuilder AddDotEnvConfiguration(this IConfigurationBuilder builder, string envFileName = ".env")
    {
        var envFilePath = FindEnvFile(envFileName);
        if (string.IsNullOrEmpty(envFilePath) || !File.Exists(envFilePath))
        {
            return builder;
        }

        var inMemoryConfig = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);

        try
        {
            var lines = File.ReadAllLines(envFilePath);
            foreach (var rawLine in lines)
            {
                var line = rawLine.Trim();
                if (string.IsNullOrWhiteSpace(line) || line.StartsWith("#"))
                    continue;

                var separatorIndex = line.IndexOf('=');
                if (separatorIndex <= 0)
                    continue;

                var key = line[..separatorIndex].Trim();
                var value = line[(separatorIndex + 1)..].Trim();

                // Trata aspas ao redor do valor
                if (value.Length >= 2 && 
                    ((value.StartsWith('"') && value.EndsWith('"')) || 
                     (value.StartsWith('\'') && value.EndsWith('\''))))
                {
                    value = value[1..^1];
                }

                // Injeta no Environment do processo caso não tenha sido definido externamente (ex: Docker/OS)
                if (Environment.GetEnvironmentVariable(key) == null)
                {
                    Environment.SetEnvironmentVariable(key, value);
                }

                // Normaliza formato hierárquico padrão do .NET (Secao__Chave -> Secao:Chave)
                var configKey = key.Replace("__", ":");
                inMemoryConfig[configKey] = value;

                // Mapeia aliases UPPER_SNAKE_CASE caso existam
                if (StandardAliases.TryGetValue(key, out var mappedKey))
                {
                    inMemoryConfig[mappedKey] = value;
                }
            }
        }
        catch
        {
            // Fail-safe silencioso para permitir fallback regular
        }

        if (inMemoryConfig.Count > 0)
        {
            builder.AddInMemoryCollection(inMemoryConfig);
        }

        return builder;
    }

    public static string? FindEnvFile(string envFileName = ".env")
    {
        var searchLocations = new[]
        {
            Directory.GetCurrentDirectory(),
            AppContext.BaseDirectory
        };

        foreach (var startDir in searchLocations)
        {
            if (string.IsNullOrEmpty(startDir)) continue;

            var current = new DirectoryInfo(startDir);
            while (current != null && current.Exists)
            {
                var candidate = Path.Combine(current.FullName, envFileName);
                if (File.Exists(candidate))
                {
                    return candidate;
                }

                current = current.Parent;
            }
        }

        return null;
    }
}
