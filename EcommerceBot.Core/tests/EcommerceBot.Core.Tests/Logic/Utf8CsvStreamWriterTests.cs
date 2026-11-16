using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using EcommerceBot.Infrastructure.Services;
using Xunit;

namespace EcommerceBot.Core.Tests.Logic;

public sealed class Utf8CsvStreamWriterTests
{
    [Fact]
    public async Task WriteFieldAsync_ShouldSanitizeCsvInjection_WhenEnabled()
    {
        using var ms = new MemoryStream();
        await using (var csv = new Utf8CsvStreamWriter(ms))
        {
            await csv.WriteFieldAsync("=SUM(A1:A10)", sanitize: true);
            await csv.WriteFieldAsync("+cmd|' /C calc'!A0", sanitize: true);
            await csv.WriteFieldAsync("-1+1", sanitize: true);
            await csv.WriteFieldAsync("@malicious", sanitize: true);
            await csv.WriteFieldAsync("NormalText", sanitize: true);
            await csv.NextRecordAsync();
        }

        string result = Encoding.UTF8.GetString(ms.ToArray());
        Assert.Equal("'=SUM(A1:A10),'+cmd|' /C calc'!A0,'-1+1,'@malicious,NormalText\r\n", result);
    }

    [Fact]
    public async Task WriteFieldAsync_ShouldEscapeCommasAndQuotes()
    {
        using var ms = new MemoryStream();
        await using (var csv = new Utf8CsvStreamWriter(ms))
        {
            await csv.WriteFieldAsync("Hello, World");
            await csv.WriteFieldAsync("Say \"Hello\"");
            await csv.WriteFieldAsync("Line 1\r\nLine 2");
            await csv.NextRecordAsync();
        }

        string result = Encoding.UTF8.GetString(ms.ToArray());
        Assert.Equal("\"Hello, World\",\"Say \"\"Hello\"\"\",\"Line 1\r\nLine 2\"\r\n", result);
    }

    [Fact]
    public async Task WriteFieldAsync_WithNumerics_ShouldFormatWithoutAllocations()
    {
        using var ms = new MemoryStream();
        await using (var csv = new Utf8CsvStreamWriter(ms))
        {
            await csv.WriteFieldAsync(199.90m);
            await csv.WriteFieldAsync((decimal?)null);
            await csv.WriteFieldAsync(42);
            await csv.WriteFieldAsync((int?)null);
            await csv.NextRecordAsync();
        }

        string result = Encoding.UTF8.GetString(ms.ToArray());
        Assert.Equal("199.90,,42,\r\n", result);
    }

    [Fact]
    public async Task Utf8CsvStreamWriter_WhenBufferThresholdIsReached_ShouldFlushSeamlessly()
    {
        using var ms = new MemoryStream();
        // Use a tiny 64-byte buffer to force multiple flushes during streaming
        await using (var csv = new Utf8CsvStreamWriter(ms, bufferSize: 64))
        {
            for (int i = 0; i < 20; i++)
            {
                await csv.WriteFieldAsync($"SKU-{i:D3}");
                await csv.WriteFieldAsync($"Product Name Description {i}");
                await csv.WriteFieldAsync(99.99m + i);
                await csv.NextRecordAsync();
            }
        }

        string result = Encoding.UTF8.GetString(ms.ToArray());
        Assert.StartsWith("SKU-000,Product Name Description 0,99.99\r\n", result);
        Assert.EndsWith("SKU-019,Product Name Description 19,118.99\r\n", result);
    }
}
