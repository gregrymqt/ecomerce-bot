using System;
using System.IO;

namespace EcommerceBot.Diagnostics.Mcp.Common;

/// <summary>
/// Utilitário centralizado para localização determinística do diretório raiz do workspace.
/// Busca recursivamente por 'EcommerceBot.sln' ou '.agents' a partir do diretório de trabalho atual
/// ou do BaseDirectory da aplicação (resolvendo execuções disparadas por hosts MCP externos).
/// </summary>
public static class WorkspaceResolver
{
    private static string? _cachedRoot;

    public static string? FindWorkspaceRoot()
    {
        if (_cachedRoot != null && Directory.Exists(_cachedRoot))
        {
            return _cachedRoot;
        }

        var searchLocations = new[]
        {
            Directory.GetCurrentDirectory(),
            AppContext.BaseDirectory,
            AppDomain.CurrentDomain.BaseDirectory
        };

        foreach (var startDir in searchLocations)
        {
            if (string.IsNullOrEmpty(startDir)) continue;

            var current = new DirectoryInfo(startDir);
            while (current != null && current.Exists)
            {
                if (File.Exists(Path.Combine(current.FullName, "EcommerceBot.sln")) ||
                    Directory.Exists(Path.Combine(current.FullName, ".agents")))
                {
                    _cachedRoot = current.FullName;
                    return _cachedRoot;
                }

                current = current.Parent;
            }
        }

        return null;
    }
}
