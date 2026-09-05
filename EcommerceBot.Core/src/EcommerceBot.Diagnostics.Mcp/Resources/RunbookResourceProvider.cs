using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using EcommerceBot.Diagnostics.Mcp.Common;
using EcommerceBot.Diagnostics.Mcp.Protocol;

namespace EcommerceBot.Diagnostics.Mcp.Resources;

/// <summary>
/// Provedor de recursos MCP que expõe dinamicamente a documentação operacional e runbooks em docs/runbooks/*.md.
/// </summary>
public class RunbookResourceProvider
{
    private const string UriPrefix = "resource://runbooks/";

    public List<McpResourceDefinition> ListResources()
    {
        var runbooksDir = FindRunbooksDirectory();
        if (runbooksDir == null || !Directory.Exists(runbooksDir))
        {
            return [];
        }

        var files = Directory.GetFiles(runbooksDir, "*.md", SearchOption.TopDirectoryOnly);
        var resources = new List<McpResourceDefinition>();

        foreach (var file in files)
        {
            var fileName = Path.GetFileNameWithoutExtension(file);
            var title = ExtractTitle(file) ?? fileName;

            resources.Add(new McpResourceDefinition
            {
                Uri = $"{UriPrefix}{fileName}",
                Name = title,
                Description = $"Guia operacional: {title}",
                MimeType = "text/markdown"
            });
        }

        // Expor relatório mais recente de ML / Spark do NotebookLM
        var reportsDir = FindReportsDirectory();
        if (reportsDir != null && Directory.Exists(reportsDir))
        {
            var latestReport = Path.Combine(reportsDir, "latest_metrics_report.md");
            if (File.Exists(latestReport))
            {
                resources.Add(new McpResourceDefinition
                {
                    Uri = "resource://ml/latest-metrics",
                    Name = "Último Relatório de Inteligência Analítica Spark & RFM",
                    Description = "Relatório consolidado de segmentação RFM e saúde preditiva gerado pelo Google Spark para o NotebookLM.",
                    MimeType = "text/markdown"
                });
            }
        }

        return resources;
    }

    public McpResourceReadResult? ReadResource(string uri)
    {
        if (string.Equals(uri, "resource://ml/latest-metrics", StringComparison.OrdinalIgnoreCase))
        {
            var reportsDir = FindReportsDirectory();
            if (reportsDir == null) return null;

            var target = Path.Combine(reportsDir, "latest_metrics_report.md");
            if (!File.Exists(target)) return null;

            var reportContent = File.ReadAllText(target);
            return new McpResourceReadResult
            {
                Contents = new List<McpResourceContent>
                {
                    new()
                    {
                        Uri = uri,
                        MimeType = "text/markdown",
                        Text = reportContent
                    }
                }
            };
        }

        if (!uri.StartsWith(UriPrefix, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var slug = uri[UriPrefix.Length..];
        var runbooksDir = FindRunbooksDirectory();
        if (runbooksDir == null) return null;

        var targetFile = Path.Combine(runbooksDir, $"{slug}.md");
        if (!File.Exists(targetFile))
        {
            return null;
        }

        var content = File.ReadAllText(targetFile);

        return new McpResourceReadResult
        {
            Contents = new List<McpResourceContent>
            {
                new()
                {
                    Uri = uri,
                    MimeType = "text/markdown",
                    Text = content
                }
            }
        };
    }

    private static string? ExtractTitle(string filePath)
    {
        try
        {
            using var reader = new StreamReader(filePath);
            string? line;
            while ((line = reader.ReadLine()) != null)
            {
                if (line.StartsWith("# "))
                {
                    return line[2..].Trim();
                }
            }
        }
        catch
        {
            // Fallback
        }

        return null;
    }

    private static string? FindRunbooksDirectory()
    {
        var root = WorkspaceResolver.FindWorkspaceRoot();
        if (root != null)
        {
            var candidate = Path.Combine(root, "docs", "runbooks");
            if (Directory.Exists(candidate))
            {
                return candidate;
            }
        }

        return null;
    }

    private static string? FindReportsDirectory()
    {
        var root = WorkspaceResolver.FindWorkspaceRoot();
        if (root != null)
        {
            var candidate = Path.Combine(root, "docs", "notebooklm", "reports");
            if (Directory.Exists(candidate))
            {
                return candidate;
            }
        }

        return null;
    }
}
