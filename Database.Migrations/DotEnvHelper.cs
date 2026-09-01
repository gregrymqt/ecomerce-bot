using System;
using System.Collections.Generic;
using System.IO;

namespace Database.Migrations;

public static class DotEnvHelper
{
    public static void Load(string envFileName = ".env")
    {
        var envFilePath = FindEnvFile(envFileName);
        if (string.IsNullOrEmpty(envFilePath) || !File.Exists(envFilePath))
        {
            return;
        }

        try
        {
            var lines = File.ReadAllLines(envFilePath);
            foreach (var rawLine in lines)
            {
                var line = rawLine.Trim();
                if (string.IsNullOrWhiteSpace(line) || line.StartsWith("#"))
                    continue;

                var separatorIndex = line.IndexOf('=');
                if (separatorIndex <= 0)
                    continue;

                var key = line[..separatorIndex].Trim();
                var value = line[(separatorIndex + 1)..].Trim();

                if (value.Length >= 2 && 
                    ((value.StartsWith('"') && value.EndsWith('"')) || 
                     (value.StartsWith('\'') && value.EndsWith('\''))))
                {
                    value = value[1..^1];
                }

                if (Environment.GetEnvironmentVariable(key) == null)
                {
                    Environment.SetEnvironmentVariable(key, value);
                }

                // Normaliza ConnectionStrings__DefaultConnection <-> MSSQL_CONNECTION_STRING
                if (key.Equals("MSSQL_CONNECTION_STRING", StringComparison.OrdinalIgnoreCase) &&
                    Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection") == null)
                {
                    Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", value);
                }
                else if (key.Equals("ConnectionStrings__DefaultConnection", StringComparison.OrdinalIgnoreCase) &&
                         Environment.GetEnvironmentVariable("MSSQL_CONNECTION_STRING") == null)
                {
                    Environment.SetEnvironmentVariable("MSSQL_CONNECTION_STRING", value);
                }
            }
        }
        catch
        {
            // Fail-safe silencioso
        }
    }

    private static string? FindEnvFile(string envFileName = ".env")
    {
        var searchLocations = new[]
        {
            Directory.GetCurrentDirectory(),
            AppContext.BaseDirectory
        };

        foreach (var startDir in searchLocations)
        {
            if (string.IsNullOrEmpty(startDir)) continue;

            var current = new DirectoryInfo(startDir);
            while (current != null && current.Exists)
            {
                var candidate = Path.Combine(current.FullName, envFileName);
                if (File.Exists(candidate))
                {
                    return candidate;
                }

                current = current.Parent;
            }
        }

        return null;
    }
}
