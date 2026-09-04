using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
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

        return resources;
    }

    public McpResourceReadResult? ReadResource(string uri)
    {
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
        var current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current != null)
        {
            var candidate = Path.Combine(current.FullName, "docs", "runbooks");
            if (Directory.Exists(candidate))
            {
                return candidate;
            }

            current = current.Parent;
        }

        return null;
    }
}
