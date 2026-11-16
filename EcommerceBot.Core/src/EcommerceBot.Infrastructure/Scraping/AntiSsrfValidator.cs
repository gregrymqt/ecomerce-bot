namespace EcommerceBot.Infrastructure.Scraping;

using System;
using System.Net;
using System.Security;

/// <summary>
/// Validador estrito contra ataques SSRF (Server-Side Request Forgery) e DNS Rebinding,
/// bloqueando hosts locais, redes privadas RFC 1918, CGNAT, endpoints de metadados em nuvem e loopback.
/// </summary>
public static class AntiSsrfValidator
{
    /// <summary>
    /// Valida o formato, protocolo e nome do host da URL antes de qualquer chamada HTTP.
    /// </summary>
    /// <param name="rawUrl">URL absoluta a ser validada.</param>
    /// <returns>A instância Uri validada.</returns>
    /// <exception cref="ArgumentException">Se a URL for nula, vazia ou inválida.</exception>
    /// <exception cref="SecurityException">Se o destino violar políticas de segurança Anti-SSRF.</exception>
    public static Uri ValidateUrlSafety(string rawUrl)
    {
        if (string.IsNullOrWhiteSpace(rawUrl))
            throw new ArgumentException("URL cannot be null or whitespace.", nameof(rawUrl));

        if (!Uri.TryCreate(rawUrl.Trim(), UriKind.Absolute, out var uri))
            throw new ArgumentException($"Invalid URL format: '{rawUrl}'", nameof(rawUrl));

        if (!string.Equals(uri.Scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
        {
            throw new SecurityException($"URL scheme '{uri.Scheme}' not allowed. Only HTTP and HTTPS are accepted.");
        }

        var host = uri.DnsSafeHost.Trim('[', ']', '.').ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(host))
            throw new SecurityException("Missing URL hostname.");

        if (host == "localhost" ||
            host == "localhost.localdomain" ||
            host.EndsWith(".localhost", StringComparison.OrdinalIgnoreCase) ||
            host.EndsWith(".local", StringComparison.OrdinalIgnoreCase) ||
            host.EndsWith(".internal", StringComparison.OrdinalIgnoreCase))
        {
            throw new SecurityException($"Local host access blocked (Anti-SSRF): {uri.Host}");
        }

        // Se o hostname for um IP literal, valida diretamente
        if (IPAddress.TryParse(host, out var ip))
        {
            EnsurePublicIP(ip);
        }

        return uri;
    }

    /// <summary>
    /// Garante que o endereço IP fornecido é público, rejeitando loopbacks, redes privadas,
    /// link-local, endpoints de metadados de cloud e faixas reservadas da IANA.
    /// </summary>
    /// <param name="ip">Endereço IP resolvido para a conexão.</param>
    /// <exception cref="SecurityException">Se o endereço for privado ou restrito.</exception>
    public static void EnsurePublicIP(IPAddress ip)
    {
        ArgumentNullException.ThrowIfNull(ip);

        // Desencapsula IPv4 mapeado em IPv6 (::ffff:192.0.2.1)
        if (ip.IsIPv4MappedToIPv6)
        {
            ip = ip.MapToIPv4();
        }

        if (IPAddress.IsLoopback(ip))
            throw new SecurityException($"Loopback IP address blocked (Anti-SSRF): {ip}");

        if (ip.Equals(IPAddress.Any) || ip.Equals(IPAddress.IPv6Any) || ip.Equals(IPAddress.None))
            throw new SecurityException($"Unspecified IP address blocked (Anti-SSRF): {ip}");

        var bytes = ip.GetAddressBytes();

        if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
        {
            // IPv4 Checks
            var b0 = bytes[0];
            var b1 = bytes[1];
            var b2 = bytes[2];

            // 0.0.0.0/8 (This host)
            if (b0 == 0)
                throw new SecurityException($"This-host network blocked (Anti-SSRF): {ip}");

            // 10.0.0.0/8 (Private RFC 1918)
            if (b0 == 10)
                throw new SecurityException($"Private network RFC 1918 blocked (Anti-SSRF): {ip}");

            // 100.64.0.0/10 (Shared Address Space / CGNAT RFC 6598)
            if (b0 == 100 && (b1 & 0xC0) == 64)
                throw new SecurityException($"Shared address space CGNAT blocked (Anti-SSRF): {ip}");

            // 127.0.0.0/8 (Loopback)
            if (b0 == 127)
                throw new SecurityException($"Loopback IP address blocked (Anti-SSRF): {ip}");

            // 169.254.0.0/16 (Link-Local / Cloud Metadata AWS, GCP, Azure 169.254.169.254)
            if (b0 == 169 && b1 == 254)
                throw new SecurityException($"Cloud metadata / link-local IP blocked (Anti-SSRF): {ip}");

            // 172.16.0.0/12 (Private RFC 1918)
            if (b0 == 172 && b1 >= 16 && b1 <= 31)
                throw new SecurityException($"Private network RFC 1918 blocked (Anti-SSRF): {ip}");

            // 192.0.0.0/24 (IETF Protocol Assignments)
            if (b0 == 192 && b1 == 0 && b2 == 0)
                throw new SecurityException($"IETF protocol assignments IP blocked (Anti-SSRF): {ip}");

            // 192.0.2.0/24 (TEST-NET-1)
            if (b0 == 192 && b1 == 0 && b2 == 2)
                throw new SecurityException($"Test-net IP blocked (Anti-SSRF): {ip}");

            // 192.168.0.0/16 (Private RFC 1918)
            if (b0 == 192 && b1 == 168)
                throw new SecurityException($"Private network RFC 1918 blocked (Anti-SSRF): {ip}");

            // 198.18.0.0/15 (Benchmarking)
            if (b0 == 198 && (b1 & 0xFE) == 18)
                throw new SecurityException($"Benchmark network IP blocked (Anti-SSRF): {ip}");

            // 198.51.100.0/24 (TEST-NET-2)
            if (b0 == 198 && b1 == 51 && b2 == 100)
                throw new SecurityException($"Test-net IP blocked (Anti-SSRF): {ip}");

            // 203.0.113.0/24 (TEST-NET-3)
            if (b0 == 203 && b1 == 0 && b2 == 113)
                throw new SecurityException($"Test-net IP blocked (Anti-SSRF): {ip}");

            // 224.0.0.0/4 (Multicast)
            if (b0 >= 224 && b0 <= 239)
                throw new SecurityException($"Multicast IP blocked (Anti-SSRF): {ip}");

            // 240.0.0.0/4 (Reserved for future use & Broadcast)
            if (b0 >= 240)
                throw new SecurityException($"Reserved/broadcast IP blocked (Anti-SSRF): {ip}");
        }
        else if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetworkV6)
        {
            // IPv6 Checks
            if (ip.IsIPv6LinkLocal || ip.IsIPv6Multicast || ip.IsIPv6SiteLocal)
                throw new SecurityException($"Restricted IPv6 address blocked (Anti-SSRF): {ip}");

            // fc00::/7 (Unique Local Address - ULA RFC 4193)
            if ((bytes[0] & 0xFE) == 0xFC)
                throw new SecurityException($"Unique Local Address (ULA) blocked (Anti-SSRF): {ip}");

            // 2001:db8::/32 (Documentation)
            if (bytes[0] == 0x20 && bytes[1] == 0x01 && bytes[2] == 0x0D && bytes[3] == 0xB8)
                throw new SecurityException($"Documentation IPv6 address blocked (Anti-SSRF): {ip}");

            // 100::/64 (Discard prefix)
            if (bytes[0] == 0x01 && bytes[1] == 0x00 && bytes[2] == 0 && bytes[3] == 0)
                throw new SecurityException($"Discard IPv6 prefix blocked (Anti-SSRF): {ip}");
        }
    }
}
