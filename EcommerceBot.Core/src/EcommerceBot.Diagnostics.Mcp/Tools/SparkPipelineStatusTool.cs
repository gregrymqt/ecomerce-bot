using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Diagnostics.Mcp.Protocol;

namespace EcommerceBot.Diagnostics.Mcp.Tools;

/// <summary>
/// Ferramenta de diagnóstico do ciclo de vida e histórico do pipeline Google Spark / PySpark Batch.
/// Permite aos agentes de IA verificar a saúde dos jobs periódicos de treino e a disponibilidade de relatórios para o NotebookLM.
/// </summary>
public class SparkPipelineStatusTool : ISystemDiagnosticTool
{
    public string Name => "check_spark_pipeline_status";

    public string Description => "Inspeciona o status e histórico de execuções do pipeline Google Spark Batch, verificando relatórios de métricas do NotebookLM e periodicidade.";

    public object InputSchema => new
    {
        type = "object",
        properties = new
        {
            limit = new
            {
                type = "integer",
                description = "Quantidade máxima de relatórios históricos recentes a listar (padrão: 5, máximo: 20)."
            }
        }
    };

    public Task<McpToolCallResult> ExecuteAsync(JsonElement? arguments)
    {
        int limit = 5;
        if (arguments.HasValue && arguments.Value.TryGetProperty("limit", out var lProp))
        {
            limit = Math.Clamp(lProp.GetInt32(), 1, 20);
        }

        var rootDir = FindWorkspaceRoot();
        if (rootDir == null)
        {
            return Task.FromResult(new McpToolCallResult
            {
                IsError = true,
                Content =
                [
                    new McpContentItem
                    {
                        Type = "text",
                        Text = "Não foi possível localizar o diretório raiz do workspace para inspecionar os relatórios do Spark."
                    }
                ]
            });
        }

        var reportsDir = Path.Combine(rootDir, "docs", "notebooklm", "reports");
        var latestReportFile = Path.Combine(reportsDir, "latest_metrics_report.md");

        var sb = new StringBuilder();
        sb.AppendLine("# ⚡ Diagnóstico do Pipeline Google Spark (Batch & Analytics Plane)");
        sb.AppendLine();

        if (!Directory.Exists(reportsDir))
        {
            sb.AppendLine($"⚠️ **Diretório de relatórios não encontrado:** `{reportsDir}`");
            sb.AppendLine("Nenhum ciclo Spark foi executado neste ambiente ainda.");
            return Task.FromResult(CreateResult(sb.ToString(), false));
        }

        var allReportFiles = Directory.GetFiles(reportsDir, "metrics_report_*.md", SearchOption.TopDirectoryOnly)
            .Select(f => new FileInfo(f))
            .OrderByDescending(f => f.LastWriteTimeUtc)
            .ToList();

        if (allReportFiles.Count == 0)
        {
            sb.AppendLine("⚠️ **Nenhum relatório Spark encontrado em `docs/notebooklm/reports/`.**");
            sb.AppendLine("O pipeline agendado ainda não concluiu seu primeiro ciclo de calibração.");
            sb.AppendLine();
            sb.AppendLine("💡 **Como executar:** `python -m app.ml.spark.run_batch` na pasta `EcommerceBot.Worker`.");
            return Task.FromResult(CreateResult(sb.ToString(), false));
        }

        var mostRecent = allReportFiles.First();
        var age = DateTime.UtcNow - mostRecent.LastWriteTimeUtc;
        string healthStatus = age.TotalHours < 24 ? "✅ ATIVO & ATUALIZADO" : (age.TotalDays < 7 ? "⚠️ DESATUALIZADO (>24h)" : "❌ ESTAGNADO (>7 dias)");

        sb.AppendLine($"### 🩺 Status Geral do Pipeline: **{healthStatus}**");
        sb.AppendLine($"- **Última Execução Spark:** {mostRecent.LastWriteTimeUtc:yyyy-MM-dd HH:mm:ss} UTC (há {FormatTimeSpan(age)})");
        sb.AppendLine($"- **Último Arquivo Gerado:** `{mostRecent.Name}` ({mostRecent.Length / 1024.0:F1} KB)");
        sb.AppendLine($"- **Total de Relatórios no Histórico:** {allReportFiles.Count}");
        sb.AppendLine();

        // Extrai resumo do último relatório gerado
        if (File.Exists(latestReportFile) || File.Exists(mostRecent.FullName))
        {
            var targetFile = File.Exists(latestReportFile) ? latestReportFile : mostRecent.FullName;
            try
            {
                var summaryLines = File.ReadLines(targetFile)
                    .Take(30)
                    .Where(l => l.StartsWith("- **") || l.StartsWith("**"))
                    .Take(5);

                sb.AppendLine("### 📈 Resumo do Último Ciclo Analítico");
                foreach (var line in summaryLines)
                {
                    sb.AppendLine(line);
                }
                sb.AppendLine();
            }
            catch
            {
                // Ignora falha de leitura parcial
            }
        }

        // Histórico dos últimos relatórios
        sb.AppendLine($"### 📜 Últimos {Math.Min(limit, allReportFiles.Count)} Relatórios de Métricas Spark");
        sb.AppendLine("| Data (UTC) | Arquivo | Tamanho | Idade |");
        sb.AppendLine("|---|---|---|---|");
        foreach (var rf in allReportFiles.Take(limit))
        {
            var fileAge = DateTime.UtcNow - rf.LastWriteTimeUtc;
            sb.AppendLine($"| {rf.LastWriteTimeUtc:yyyy-MM-dd HH:mm} | `{rf.Name}` | {rf.Length / 1024.0:F1} KB | há {FormatTimeSpan(fileAge)} |");
        }

        sb.AppendLine();
        sb.AppendLine("---");
        sb.AppendLine("💡 *Para consultar o relatório completo formatado, utilize o recurso:* `resource://ml/latest-metrics`");

        return Task.FromResult(CreateResult(sb.ToString(), false));
    }

    private static string FormatTimeSpan(TimeSpan ts)
    {
        if (ts.TotalMinutes < 1) return $"{ts.Seconds}s";
        if (ts.TotalHours < 1) return $"{(int)ts.TotalMinutes}m";
        if (ts.TotalDays < 1) return $"{(int)ts.TotalHours}h";
        return $"{(int)ts.TotalDays}d e {ts.Hours}h";
    }

    private static McpToolCallResult CreateResult(string text, bool isError)
    {
        return new McpToolCallResult
        {
            IsError = isError,
            Content =
            [
                new McpContentItem
                {
                    Type = "text",
                    Text = text
                }
            ]
        };
    }

    private static string? FindWorkspaceRoot()
    {
        var current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current != null)
        {
            if (File.Exists(Path.Combine(current.FullName, "EcommerceBot.sln")) ||
                Directory.Exists(Path.Combine(current.FullName, ".agents")))
            {
                return current.FullName;
            }

            current = current.Parent;
        }

        return null;
    }
}
