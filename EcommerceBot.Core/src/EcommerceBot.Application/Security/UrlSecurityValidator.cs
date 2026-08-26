using System;
using System.Net;
using System.Net.Sockets;

namespace EcommerceBot.Application.Security;

/// <summary>
/// Validador de segurança para URLs de extração e webhooks, garantindo proteção contra Server-Side Request Forgery (SSRF).
/// </summary>
public static class UrlSecurityValidator
{
    /// <summary>
    /// Valida se a URL fornecida é pública e segura, bloqueando loopbacks, redes privadas RFC 1918 e metadados de nuvem.
    /// </summary>
    public static bool IsSafePublicUrl(string? urlString)
    {
        if (string.IsNullOrWhiteSpace(urlString))
            return false;

        if (!Uri.TryCreate(urlString, UriKind.Absolute, out var uri))
            return false;

        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            return false;

        var host = uri.DnsSafeHost.ToLowerInvariant();
        if (host == "localhost" || host.EndsWith(".localhost") || host.EndsWith(".local") || host == "127.0.0.1" || host == "::1")
            return false;

        if (IPAddress.TryParse(host, out var ip))
        {
            if (IPAddress.IsLoopback(ip) || IPAddress.Any.Equals(ip) || IPAddress.IPv6Any.Equals(ip))
                return false;

            if (ip.AddressFamily == AddressFamily.InterNetwork)
            {
                var bytes = ip.GetAddressBytes();
                // 10.0.0.0/8
                if (bytes[0] == 10) return false;
                // 172.16.0.0/12
                if (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) return false;
                // 192.168.0.0/16
                if (bytes[0] == 192 && bytes[1] == 168) return false;
                // 169.254.0.0/16 (Link Local / Cloud Metadata)
                if (bytes[0] == 169 && bytes[1] == 254) return false;
                // 0.0.0.0
                if (bytes[0] == 0) return false;
            }
            else if (ip.AddressFamily == AddressFamily.InterNetworkV6)
            {
                if (ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal || ip.IsIPv6Multicast)
                    return false;
            }
        }

        return true;
    }
}
