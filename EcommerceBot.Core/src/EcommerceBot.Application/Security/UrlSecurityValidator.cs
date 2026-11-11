using System;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;

namespace EcommerceBot.Application.Security;

/// <summary>
/// Validador de segurança para URLs de extração e webhooks, garantindo proteção Fail-Closed contra SSRF.
/// </summary>
public static class UrlSecurityValidator
{
    /// <summary>
    /// Valida sintaxe HTTP/HTTPS, bloqueia hostnames locais e valida IPs literais (síncrono).
    /// Para validação completa contra DNS Rebinding, utilize <see cref="IsSafePublicUrlAsync"/>.
    /// </summary>
    public static bool IsSafePublicUrl(string? urlString)
    {
        if (!TryValidateSchemeAndHost(urlString, out var host))
            return false;

        if (IPAddress.TryParse(host, out var ip))
            return !IsPrivateOrReservedIp(ip);

        return true;
    }

    /// <summary>
    /// Valida sintaxe HTTP/HTTPS e resolve DNS assincronamente em modo Fail-Closed:
    /// rejeita caso a resolução falhe, retorne vazia ou contenha qualquer IP privado/reservado/CGNAT/ULA.
    /// </summary>
    public static async Task<bool> IsSafePublicUrlAsync(
        string? urlString,
        Func<string, CancellationToken, Task<IPAddress[]>>? dnsResolver = null,
        CancellationToken cancellationToken = default)
    {
        if (!TryValidateSchemeAndHost(urlString, out var host))
            return false;

        if (IPAddress.TryParse(host, out var literalIp))
            return !IsPrivateOrReservedIp(literalIp);

        IPAddress[] resolvedAddresses;
        try
        {
            var resolver = dnsResolver ?? Dns.GetHostAddressesAsync;
            resolvedAddresses = await resolver(host, cancellationToken);
        }
        catch
        {
            // Fail-Closed: falha de resolução DNS impede a requisição SSRF
            return false;
        }

        if (resolvedAddresses == null || resolvedAddresses.Length == 0)
            return false;

        foreach (var address in resolvedAddresses)
        {
            if (IsPrivateOrReservedIp(address))
                return false;
        }

        return true;
    }

    private static bool TryValidateSchemeAndHost(string? urlString, out string host)
    {
        host = string.Empty;
        if (string.IsNullOrWhiteSpace(urlString))
            return false;

        if (!Uri.TryCreate(urlString.Trim(), UriKind.Absolute, out var uri))
            return false;

        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            return false;

        var candidate = uri.DnsSafeHost.Trim().TrimEnd('.').ToLowerInvariant();
        if (string.IsNullOrEmpty(candidate))
            return false;

        if (candidate == "localhost"
            || candidate.EndsWith(".localhost", StringComparison.Ordinal)
            || candidate.EndsWith(".local", StringComparison.Ordinal)
            || candidate.EndsWith(".internal", StringComparison.Ordinal)
            || candidate == "127.0.0.1"
            || candidate == "::1")
        {
            return false;
        }

        host = candidate;
        return true;
    }

    internal static bool IsPrivateOrReservedIp(IPAddress address)
    {
        if (address.IsIPv4MappedToIPv6)
        {
            address = address.MapToIPv4();
        }

        if (IPAddress.IsLoopback(address)
            || IPAddress.Any.Equals(address)
            || IPAddress.IPv6Any.Equals(address)
            || IPAddress.None.Equals(address)
            || IPAddress.IPv6None.Equals(address))
        {
            return true;
        }

        if (address.AddressFamily == AddressFamily.InterNetwork)
        {
            var bytes = address.GetAddressBytes();
            // 0.0.0.0/8 ("This network")
            if (bytes[0] == 0) return true;
            // 10.0.0.0/8 (RFC 1918)
            if (bytes[0] == 10) return true;
            // 100.64.0.0/10 (CGNAT RFC 6598)
            if (bytes[0] == 100 && bytes[1] >= 64 && bytes[1] <= 127) return true;
            // 127.0.0.0/8 (Loopback)
            if (bytes[0] == 127) return true;
            // 169.254.0.0/16 (Link-Local / Cloud Metadata IMDS)
            if (bytes[0] == 169 && bytes[1] == 254) return true;
            // 172.16.0.0/12 (RFC 1918)
            if (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) return true;
            // 192.168.0.0/16 (RFC 1918)
            if (bytes[0] == 192 && bytes[1] == 168) return true;
            // 224.0.0.0/4 (Multicast) e >= 240.0.0.0/4 (Reservado / Broadcast)
            if (bytes[0] >= 224) return true;

            return false;
        }

        if (address.AddressFamily == AddressFamily.InterNetworkV6)
        {
            if (address.IsIPv6LinkLocal
                || address.IsIPv6SiteLocal
                || address.IsIPv6Multicast
                || address.IsIPv6UniqueLocal
                || address.IsIPv6Teredo)
            {
                return true;
            }

            // Garantia explícita para ULA fc00::/7 (RFC 4193)
            var bytes = address.GetAddressBytes();
            if ((bytes[0] & 0xFE) == 0xFC)
                return true;

            return false;
        }

        return true;
    }
}
