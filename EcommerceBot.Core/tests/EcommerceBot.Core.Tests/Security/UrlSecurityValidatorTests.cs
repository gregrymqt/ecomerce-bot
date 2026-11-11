using System;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.Security;
using FluentAssertions;
using Xunit;

namespace EcommerceBot.Core.Tests.Security;

public sealed class UrlSecurityValidatorTests
{
    [Theory]
    [InlineData("http://[::ffff:127.0.0.1]/admin")]
    [InlineData("http://[::ffff:169.254.169.254]/latest/meta-data")]
    [InlineData("http://[fc00::1]/")]
    [InlineData("http://[fd12:3456:789a::1]/")]
    [InlineData("http://100.64.0.1/")]
    [InlineData("http://169.254.169.254/latest/meta-data")]
    [InlineData("http://10.0.0.1/")]
    [InlineData("http://metadata.internal/")]
    public async Task IsSafePublicUrlAsync_BlocksReservedAndBypassRanges(string url)
    {
        var result = await UrlSecurityValidator.IsSafePublicUrlAsync(
            url,
            dnsResolver: (_, _) => Task.FromResult(new[] { IPAddress.Parse("93.184.216.34") }));

        result.Should().BeFalse();
    }

    [Fact]
    public async Task IsSafePublicUrlAsync_BlocksDnsRebindingToPrivateIp()
    {
        var result = await UrlSecurityValidator.IsSafePublicUrlAsync(
            "https://rebind.attacker.example/product",
            dnsResolver: (_, _) => Task.FromResult(new[]
            {
                IPAddress.Parse("93.184.216.34"),
                IPAddress.Parse("127.0.0.1")
            }));

        result.Should().BeFalse();
    }

    [Fact]
    public async Task IsSafePublicUrlAsync_FailsClosedOnDnsFailureOrEmptyResponse()
    {
        var failed = await UrlSecurityValidator.IsSafePublicUrlAsync(
            "https://unresolvable.invalid/item",
            dnsResolver: (_, _) => Task.FromException<IPAddress[]>(new SocketException()));

        var empty = await UrlSecurityValidator.IsSafePublicUrlAsync(
            "https://empty.invalid/item",
            dnsResolver: (_, _) => Task.FromResult(Array.Empty<IPAddress>()));

        failed.Should().BeFalse();
        empty.Should().BeFalse();
    }

    [Fact]
    public async Task IsSafePublicUrlAsync_AllowsPublicDomainResolvingToPublicIp()
    {
        var allowed = await UrlSecurityValidator.IsSafePublicUrlAsync(
            "https://loja-valida.example/produto/123",
            dnsResolver: (_, _) => Task.FromResult(new[] { IPAddress.Parse("93.184.216.34") }));

        allowed.Should().BeTrue();
    }
}
