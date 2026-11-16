using System;
using System.Buffers;
using System.Buffers.Text;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace EcommerceBot.Infrastructure.Services;

/// <summary>
/// Escritor CSV de streaming assíncrono de alto desempenho e baixa alocação,
/// utilizando ArrayPool&lt;byte&gt;, Utf8Formatter e sanitização direta contra injeção de fórmulas.
/// </summary>
public sealed class Utf8CsvStreamWriter : IAsyncDisposable
{
    private readonly Stream _stream;
    private readonly byte[] _buffer;
    private int _position;
    private bool _firstFieldInRecord = true;

    private static readonly SearchValues<char> CsvSpecialChars = SearchValues.Create(",\"\r\n");

    public Utf8CsvStreamWriter(Stream stream, int bufferSize = 65536)
    {
        _stream = stream ?? throw new ArgumentNullException(nameof(stream));
        _buffer = ArrayPool<byte>.Shared.Rent(bufferSize);
        _position = 0;
    }

    public async ValueTask WriteFieldAsync(string? value, bool sanitize = true, CancellationToken ct = default)
    {
        await PrepareFieldSeparatorAsync(ct);

        if (string.IsNullOrEmpty(value))
            return;

        bool needsSanitize = sanitize && IsInjectionChar(value[0]);
        bool needsQuotes = value.AsSpan().ContainsAny(CsvSpecialChars);

        if (!needsSanitize && !needsQuotes)
        {
            await WriteRawStringAsync(value, 0, value.Length, ct);
            return;
        }

        if (needsQuotes)
        {
            await EnsureCapacityAsync(1, ct);
            _buffer[_position++] = (byte)'"';
        }

        if (needsSanitize)
        {
            await EnsureCapacityAsync(1, ct);
            _buffer[_position++] = (byte)'\'';
        }

        if (!needsQuotes)
        {
            await WriteRawStringAsync(value, 0, value.Length, ct);
        }
        else
        {
            int start = 0;
            while (start < value.Length)
            {
                int quoteIdx = value.IndexOf('"', start);
                if (quoteIdx < 0)
                {
                    await WriteRawStringAsync(value, start, value.Length - start, ct);
                    break;
                }

                if (quoteIdx > start)
                {
                    await WriteRawStringAsync(value, start, quoteIdx - start, ct);
                }

                await EnsureCapacityAsync(2, ct);
                _buffer[_position++] = (byte)'"';
                _buffer[_position++] = (byte)'"';

                start = quoteIdx + 1;
            }

            await EnsureCapacityAsync(1, ct);
            _buffer[_position++] = (byte)'"';
        }
    }

    public async ValueTask WriteFieldAsync(decimal? value, CancellationToken ct = default)
    {
        await PrepareFieldSeparatorAsync(ct);
        if (!value.HasValue) return;

        await EnsureCapacityAsync(32, ct);
        if (Utf8Formatter.TryFormat(value.Value, _buffer.AsSpan(_position, 32), out int bytesWritten))
        {
            _position += bytesWritten;
        }
    }

    public async ValueTask WriteFieldAsync(int? value, CancellationToken ct = default)
    {
        await PrepareFieldSeparatorAsync(ct);
        if (!value.HasValue) return;

        await EnsureCapacityAsync(16, ct);
        if (Utf8Formatter.TryFormat(value.Value, _buffer.AsSpan(_position, 16), out int bytesWritten))
        {
            _position += bytesWritten;
        }
    }

    public async ValueTask NextRecordAsync(CancellationToken ct = default)
    {
        await EnsureCapacityAsync(2, ct);
        _buffer[_position++] = (byte)'\r';
        _buffer[_position++] = (byte)'\n';
        _firstFieldInRecord = true;
    }

    public async ValueTask FlushAsync(CancellationToken ct = default)
    {
        await FlushBufferOnlyAsync(ct);
        await _stream.FlushAsync(ct);
    }

    public async ValueTask DisposeAsync()
    {
        try
        {
            await FlushBufferOnlyAsync(CancellationToken.None);
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(_buffer);
        }
    }

    private async ValueTask PrepareFieldSeparatorAsync(CancellationToken ct)
    {
        if (!_firstFieldInRecord)
        {
            await EnsureCapacityAsync(1, ct);
            _buffer[_position++] = (byte)',';
        }
        else
        {
            _firstFieldInRecord = false;
        }
    }

    private async ValueTask EnsureCapacityAsync(int needed, CancellationToken ct)
    {
        if (_position + needed > _buffer.Length)
        {
            await FlushBufferOnlyAsync(ct);
        }
    }

    private async ValueTask FlushBufferOnlyAsync(CancellationToken ct)
    {
        if (_position > 0)
        {
            await _stream.WriteAsync(_buffer.AsMemory(0, _position), ct);
            _position = 0;
        }
    }

    private async ValueTask WriteRawStringAsync(string value, int start, int count, CancellationToken ct)
    {
        if (count <= 0) return;

        int offset = start;
        int remaining = count;

        while (remaining > 0)
        {
            if (_position >= _buffer.Length)
            {
                await FlushBufferOnlyAsync(ct);
            }

            int availableBytes = _buffer.Length - _position;
            int charsToTake = Math.Min(remaining, Math.Max(1, availableBytes / 3));

            int bytesWritten = Encoding.UTF8.GetBytes(value, offset, charsToTake, _buffer, _position);
            _position += bytesWritten;
            offset += charsToTake;
            remaining -= charsToTake;
        }
    }

    private static bool IsInjectionChar(char c) =>
        c is '=' or '+' or '-' or '@' or '\t' or '\r';
}
