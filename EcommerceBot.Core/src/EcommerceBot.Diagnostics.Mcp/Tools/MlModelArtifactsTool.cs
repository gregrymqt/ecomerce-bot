using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Diagnostics.Mcp.Protocol;

namespace EcommerceBot.Diagnostics.Mcp.Tools;

/// <summary>
/// Ferramenta de inspeção de artefatos de Machine Learning (.joblib) e metadados gerados pelo Google Spark.
/// Permite aos agentes de IA auditar a calibração de modelos (RFM, Churn) e métricas de acurácia (Silhouette Score).
/// </summary>
public class MlModelArtifactsTool : ISystemDiagnosticTool
{
    public string Name => "inspect_ml_artifacts";

    public string Description => "Inspeciona os artefatos de Machine Learning (.joblib) e o manifesto de metadados gerados pelo Google Spark / PySpark no ecossistema.";

    public object InputSchema => new
    {
        type = "object",
        properties = new
        {
            modelName = new
            {
                type = "string",
                description = "Nome do modelo para inspecionar (padrão: 'rfm_pipeline')."
            }
        }
    };

    public Task<McpToolCallResult> ExecuteAsync(JsonElement? arguments)
    {
        string modelName = "rfm_pipeline";
        if (arguments.HasValue && arguments.Value.TryGetProperty("modelName", out var mProp))
        {
            var val = mProp.GetString();
            if (!string.IsNullOrWhiteSpace(val))
            {
                modelName = val.Trim();
            }
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
                        Text = "Não foi possível localizar o diretório raiz do workspace para inspecionar os artefatos de ML."
                    }
                ]
            });
        }

        var artifactsDir = Path.Combine(rootDir, "EcommerceBot.Worker", "app", "ml", "models", "artifacts");
        var joblibFile = Path.Combine(artifactsDir, $"{modelName}.joblib");
        var metadataFile = Path.Combine(artifactsDir, $"{modelName}_metadata.json");

        var sb = new StringBuilder();
        sb.AppendLine($"# 🔬 Inspeção de Artefato de Machine Learning: {modelName}");
        sb.AppendLine();

        if (!Directory.Exists(artifactsDir))
        {
            sb.AppendLine($"❌ **Diretório de artefatos não encontrado:** `{artifactsDir}`");
            return Task.FromResult(CreateResult(sb.ToString(), false));
        }

        bool joblibExists = File.Exists(joblibFile);
        bool metadataExists = File.Exists(metadataFile);

        if (!joblibExists && !metadataExists)
        {
            sb.AppendLine($"⚠️ **Nenhum artefato calibrado encontrado para '{modelName}'.**");
            sb.AppendLine("O Worker Python utilizará o fallback heurístico em tempo real até que o primeiro job Spark seja executado.");
            sb.AppendLine();
            sb.AppendLine("💡 **Como gerar:** Execute `python -m app.ml.spark.run_batch` no `EcommerceBot.Worker`.");
            return Task.FromResult(CreateResult(sb.ToString(), false));
        }

        // Informações do binário .joblib
        if (joblibExists)
        {
            var fi = new FileInfo(joblibFile);
            var sizeKb = fi.Length / 1024.0;
            var lastMod = fi.LastWriteTimeUtc;
            var age = DateTime.UtcNow - lastMod;

            sb.AppendLine("### 📦 Arquivo Binário Serializado (.joblib)");
            sb.AppendLine($"- **Caminho:** `{joblibFile}`");
            sb.AppendLine($"- **Tamanho:** {sizeKb:F1} KB");
            sb.AppendLine($"- **Última Modificação:** {lastMod:yyyy-MM-dd HH:mm:ss} UTC (há {FormatTimeSpan(age)})");
            sb.AppendLine();
        }
        else
        {
            sb.AppendLine("⚠️ Arquivo binário `.joblib` não encontrado em disco.");
            sb.AppendLine();
        }

        // Informações do Manifesto JSON
        if (metadataExists)
        {
            try
            {
                var jsonContent = File.ReadAllText(metadataFile, Encoding.UTF8);
                using var doc = JsonDocument.Parse(jsonContent);
                var root = doc.RootElement;

                sb.AppendLine("### 📊 Metadados de Treinamento e Calibração Spark");
                if (root.TryGetProperty("model", out var m)) sb.AppendLine($"- **Modelo:** `{m.GetString()}`");
                if (root.TryGetProperty("version", out var v)) sb.AppendLine($"- **Versão:** `{v.GetString()}`");
                if (root.TryGetProperty("trainedAt", out var t)) sb.AppendLine($"- **Treinado em:** {t.GetString()}");
                if (root.TryGetProperty("sampleCount", out var sc)) sb.AppendLine($"- **Amostras / Clientes:** {sc.GetInt32():N0}");
                if (root.TryGetProperty("clusterCount", out var cc)) sb.AppendLine($"- **Número de Clusters:** {cc.GetInt32()}");
                if (root.TryGetProperty("totalRevenue", out var tr)) sb.AppendLine($"- **Faturamento Consolidado:** R$ {tr.GetDouble():N2}");
                
                if (root.TryGetProperty("silhouetteScore", out var sil))
                {
                    double score = sil.GetDouble();
                    string silStatus = score >= 0.35 ? "✅ Ótimo (>0.35)" : "⚠️ Alerta de Baixa Separação (<0.35)";
                    sb.AppendLine($"- **Silhouette Score (Qualidade):** {score:F4} ({silStatus})");
                }

                if (root.TryGetProperty("status", out var st))
                {
                    sb.AppendLine($"- **Status de Saúde:** `{st.GetString()}`");
                }

                if (root.TryGetProperty("clusterDistribution", out var cd) && cd.ValueKind == JsonValueKind.Object)
                {
                    sb.AppendLine();
                    sb.AppendLine("#### 👥 Distribuição dos Clusters de Clientes");
                    sb.AppendLine("| Cluster | Rótulo Segmentado | Clientes | % Base |");
                    sb.AppendLine("|---|---|---|---|");
                    foreach (var prop in cd.EnumerateObject())
                    {
                        var label = prop.Value.TryGetProperty("label", out var lb) ? lb.GetString() : prop.Name;
                        var count = prop.Value.TryGetProperty("count", out var cnt) ? cnt.GetInt32() : 0;
                        var pct = prop.Value.TryGetProperty("percentage", out var p) ? p.GetDouble() : 0.0;
                        sb.AppendLine($"| {prop.Name} | **{label}** | {count} | {pct:F1}% |");
                    }
                }
            }
            catch (Exception ex)
            {
                sb.AppendLine($"⚠️ Falha ao ler o manifesto JSON de metadados: {ex.Message}");
            }
        }
        else
        {
            sb.AppendLine("ℹ️ Manifesto de metadados `rfm_pipeline_metadata.json` ainda não gerado.");
        }

        sb.AppendLine();
        sb.AppendLine("---");
        sb.AppendLine("✅ *Artefatos de inferência em conformidade com a Arquitetura Tripartite de ML.*");

        return Task.FromResult(CreateResult(sb.ToString(), false));
    }

    private static string FormatTimeSpan(TimeSpan ts)
    {
        if (ts.TotalMinutes < 1) return $"{ts.Seconds} segundos";
        if (ts.TotalHours < 1) return $"{(int)ts.TotalMinutes} minutos";
        if (ts.TotalDays < 1) return $"{(int)ts.TotalHours} horas";
        return $"{(int)ts.TotalDays} dias e {ts.Hours} horas";
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
