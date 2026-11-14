using System;
using Npgsql;

namespace Database.Migrations;

/// <summary>
/// Helper para configuração determinística de extensões e observabilidade no PostgreSQL 16.
/// PostgreSQL usa MVCC por padrão (equivalente a RCSI/Snapshot Isolation nativo).
/// </summary>
public static class DatabaseConfigurationHelper
{
    public static void ConfigureDatabaseOptions(string connectionString)
    {
        Console.WriteLine("⚙️ [Hardening] Verificando extensões e observabilidade no PostgreSQL...");

        try
        {
            using var connection = new NpgsqlConnection(connectionString);
            connection.Open();

            // Garante extensões essenciais para UUIDs, criptografia e métricas
            const string sql = """
                CREATE EXTENSION IF NOT EXISTS pgcrypto;
                CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
                CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
            """;

            using var cmd = new NpgsqlCommand(sql, connection);
            cmd.ExecuteNonQuery();

            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("   • Extensões PostgreSQL (pgcrypto, uuid-ossp, pg_stat_statements) ativas.");
            Console.ResetColor();
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine($"ℹ️ Aviso durante ativação de extensões: {ex.Message}");
            Console.ResetColor();
        }
    }
}
