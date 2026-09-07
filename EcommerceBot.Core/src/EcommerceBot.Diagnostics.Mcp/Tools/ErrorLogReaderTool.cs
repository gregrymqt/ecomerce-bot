using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Diagnostics.Mcp.Common;
using EcommerceBot.Diagnostics.Mcp.Protocol;

namespace EcommerceBot.Diagnostics.Mcp.Tools;

/// <summary>
/// Ferramenta de leitura de logs de erro estruturados gerados pelo Serilog (logs/errors-*.json).
/// Abre os arquivos em modo compartilhado (FileShare.ReadWrite) para leitura sem travar o processo da API.
/// Suporta cancelamento cooperativo via CancellationToken.
/// </summary>
public sealed class ErrorLogReaderTool : ISystemDiagnosticTool
{
    public string Name => "get_recent_application_errors";

    public string Description => "Lê as últimas falhas (Warning, Error, Fatal) registradas pelo Serilog nos arquivos rotativos JSON da API Core sem bloquear a aplicação.";

    public object InputSchema => new
    {
        type = "object",
        properties = new
        {
            limit = new
            {
                type = "integer",
                description = "Quantidade máxima de erros recentes para retornar (padrão: 10, máximo: 50)."
            },
            minLevel = new
            {
                type = "string",
                description = "Nível mínimo de severidade: 'Warning', 'Error' ou 'Fatal' (padrão: 'Warning')."
            }
        }
    };

    public async Task<McpToolCallResult> ExecuteAsync(JsonElement? arguments, CancellationToken cancellationToken = default)
    {
        int limit = 10;
        string minLevel = "Warning";

        if (arguments.HasValue)
        {
            if (arguments.Value.TryGetProperty("limit", out var lProp))
                limit = Math.Clamp(lProp.GetInt32(), 1, 50);

            if (arguments.Value.TryGetProperty("minLevel", out var mlProp))
                minLevel = mlProp.GetString() ?? "Warning";
        }

        try
        {
            cancellationToken.ThrowIfCancellationRequested();

            var logFiles = FindErrorLogFiles();
            if (logFiles.Count == 0)
            {
                return new McpToolCallResult
                {
                    IsError = false,
                    Content =
                    [
                        new()
                        {
                            Type = "text",
                            Text = JsonSerializer.Serialize(new
                            {
                                status = "NO_LOGS_FOUND",
                                message = "Nenhum arquivo de log de erro rotativo encontrado ainda em logs/errors-*.json. A API ainda não registrou falhas ou o diretório de logs não foi criado."
                            }, new JsonSerializerOptions { WriteIndented = true })
                        }
                    ]
                };
            }

            // Ler o arquivo mais recente
            var newestLogFile = logFiles.OrderByDescending(File.GetLastWriteTimeUtc).First();
            var rawLines = await ReadTailLinesAsync(newestLogFile, limit * 5, cancellationToken);

            var parsedErrors = new List<object>();
            foreach (var line in rawLines.AsEnumerable().Reverse())
            {
                cancellationToken.ThrowIfCancellationRequested();

                if (string.IsNullOrWhiteSpace(line)) continue;

                try
                {
                    using var doc = JsonDocument.Parse(line);
                    var root = doc.RootElement;

                    string timestamp = root.TryGetProperty("@t", out var t) ? t.GetString() ?? "" : "";
                    string level = root.TryGetProperty("@l", out var l) ? l.GetString() ?? "Information" : "Information";
                    string message = root.TryGetProperty("@m", out var m) ? m.GetString() ?? "" : "";
                    string? exception = root.TryGetProperty("@x", out var x) ? x.GetString() : null;

                    string sourceContext = root.TryGetProperty("SourceContext", out var sc) ? sc.GetString() ?? "" : "";
                    string requestPath = root.TryGetProperty("RequestPath", out var rp) ? rp.GetString() ?? "" : "";

                    if (ShouldInclude(level, minLevel))
                    {
                        parsedErrors.Add(new
                        {
                            timestamp,
                            level,
                            message,
                            sourceContext,
                            requestPath,
                            exception = exception != null ? (exception.Length > 600 ? exception[..600] + "..." : exception) : null
                        });

                        if (parsedErrors.Count >= limit) break;
                    }
                }
                catch
                {
                    // Ignora linhas que não sejam JSON válido
                }
            }

            var report = new
            {
                file = Path.GetFileName(newestLogFile),
                errorsFound = parsedErrors.Count,
                errors = parsedErrors
            };

            return new McpToolCallResult
            {
                IsError = false,
                Content =
                [
                    new()
                    {
                        Type = "text",
                        Text = JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true })
                    }
                ]
            };
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            return new McpToolCallResult
            {
                IsError = true,
                Content =
                [
                    new()
                    {
                        Type = "text",
                        Text = "Operação de leitura de logs cancelada."
                    }
                ]
            };
        }
        catch (Exception ex)
        {
            return new McpToolCallResult
            {
                IsError = true,
                Content =
                [
                    new()
                    {
                        Type = "text",
                        Text = $"Erro ao ler logs de aplicação: {ex.Message}"
                    }
                ]
            };
        }
    }

    private static bool ShouldInclude(string currentLevel, string minLevel)
    {
        static int Rank(string lvl) => lvl.ToUpperInvariant() switch
        {
            "INFORMATION" or "INFO" => 1,
            "WARNING" or "WARN" => 2,
            "ERROR" => 3,
            "FATAL" => 4,
            _ => 0
        };

        return Rank(currentLevel) >= Rank(minLevel);
    }

    private static List<string> FindErrorLogFiles()
    {
        var candidates = new List<string>();
        var searchRoots = new List<string>
        {
            Directory.GetCurrentDirectory(),
            Path.Combine(Directory.GetCurrentDirectory(), "logs"),
            Path.Combine(Directory.GetCurrentDirectory(), "EcommerceBot.Core", "src", "EcommerceBot.Api", "logs"),
            Path.Combine(Directory.GetCurrentDirectory(), "..", "EcommerceBot.Api", "logs"),
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs")
        };

        var root = WorkspaceResolver.FindWorkspaceRoot();
        if (root != null)
        {
            searchRoots.Add(Path.Combine(root, "logs"));
            searchRoots.Add(Path.Combine(root, "EcommerceBot.Core", "src", "EcommerceBot.Api", "logs"));
        }

        foreach (var dir in searchRoots)
        {
            if (Directory.Exists(dir))
            {
                candidates.AddRange(Directory.GetFiles(dir, "errors-*.json", SearchOption.TopDirectoryOnly));
            }
        }

        return candidates.Distinct().ToList();
    }

    private static async Task<List<string>> ReadTailLinesAsync(string filePath, int lineCount, CancellationToken cancellationToken)
    {
        var lines = new List<string>();
        await using var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        using var reader = new StreamReader(fs, Encoding.UTF8);

        string? line;
        while ((line = await reader.ReadLineAsync(cancellationToken)) != null)
        {
            lines.Add(line);
            if (lines.Count > lineCount * 2)
            {
                lines.RemoveRange(0, lines.Count - lineCount);
            }
        }

        return lines;
    }
}
