using System;
using Microsoft.Data.SqlClient;

namespace Database.Migrations;

/// <summary>
/// Helper para configuração determinística de concorrência e observabilidade no SQL Server 2022.
/// Aplica RCSI (Read Committed Snapshot Isolation) e Query Store fora de transações de scripts do DbUp.
/// </summary>
public static class DatabaseConfigurationHelper
{
    public static void ConfigureDatabaseOptions(string connectionString)
    {
        var builder = new SqlConnectionStringBuilder(connectionString);
        var targetDatabase = string.IsNullOrWhiteSpace(builder.InitialCatalog) ? "EcommerceBotDb" : builder.InitialCatalog;

        Console.WriteLine($"⚙️ [Hardening] Verificando concorrência (RCSI) e Query Store para [{targetDatabase}]...");

        try
        {
            EnsureRcsiAndSnapshotIsolation(builder, targetDatabase);
            EnsureQueryStore(connectionString, targetDatabase);
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine($"⚠️ Aviso durante configuração de concorrência/Query Store: {ex.Message}");
            Console.ResetColor();
        }
    }

    private static void EnsureRcsiAndSnapshotIsolation(SqlConnectionStringBuilder originalBuilder, string targetDatabase)
    {
        bool rcsiEnabled = false;
        bool snapshotEnabled = false;

        // 1. Inspeciona o estado atual do banco
        using (var checkConnection = new SqlConnection(originalBuilder.ConnectionString))
        {
            checkConnection.Open();
            const string checkSql = """
                SELECT is_read_committed_snapshot_on, snapshot_isolation_state 
                FROM sys.databases 
                WHERE name = @DbName;
                """;

            using var cmd = new SqlCommand(checkSql, checkConnection);
            cmd.Parameters.AddWithValue("@DbName", targetDatabase);
            using var reader = cmd.ExecuteReader();
            if (reader.Read())
            {
                rcsiEnabled = reader.GetBoolean(0);
                snapshotEnabled = reader.GetByte(1) == 1;
            }
        }

        if (rcsiEnabled && snapshotEnabled)
        {
            Console.ForegroundColor = ConsoleColor.DarkGreen;
            Console.WriteLine("   • Concorrência: RCSI e Snapshot Isolation já estão ativos (Anti-Locking OK).");
            Console.ResetColor();
            return;
        }

        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine("   • Concorrência: Ativando READ_COMMITTED_SNAPSHOT e ALLOW_SNAPSHOT_ISOLATION...");
        Console.ResetColor();

        // 2. Conecta ao master para alternar o isolamento com segurança (evitando auto-lock de sessão)
        var masterBuilder = new SqlConnectionStringBuilder(originalBuilder.ConnectionString)
        {
            InitialCatalog = "master"
        };

        try
        {
            using var masterConn = new SqlConnection(masterBuilder.ConnectionString);
            masterConn.Open();

            var alterSql = $"""
                ALTER DATABASE [{targetDatabase}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
                ALTER DATABASE [{targetDatabase}] SET READ_COMMITTED_SNAPSHOT ON;
                ALTER DATABASE [{targetDatabase}] SET ALLOW_SNAPSHOT_ISOLATION ON;
                ALTER DATABASE [{targetDatabase}] SET MULTI_USER;
                """;

            using var alterCmd = new SqlCommand(alterSql, masterConn);
            alterCmd.CommandTimeout = 30;
            alterCmd.ExecuteNonQuery();

            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("   • Concorrência: ✅ RCSI e Snapshot Isolation habilitados com sucesso!");
            Console.ResetColor();
        }
        catch (Exception)
        {
            // Fallback: tenta executar diretamente no contexto do próprio banco
            using var fallbackConn = new SqlConnection(originalBuilder.ConnectionString);
            fallbackConn.Open();

            var fallbackSql = $"""
                ALTER DATABASE [{targetDatabase}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
                ALTER DATABASE [{targetDatabase}] SET READ_COMMITTED_SNAPSHOT ON;
                ALTER DATABASE [{targetDatabase}] SET ALLOW_SNAPSHOT_ISOLATION ON;
                ALTER DATABASE [{targetDatabase}] SET MULTI_USER;
                """;

            using var fallbackCmd = new SqlCommand(fallbackSql, fallbackConn);
            fallbackCmd.CommandTimeout = 30;
            fallbackCmd.ExecuteNonQuery();

            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("   • Concorrência: ✅ RCSI habilitado via conexão direta.");
            Console.ResetColor();
        }
    }

    private static void EnsureQueryStore(string connectionString, string targetDatabase)
    {
        short queryStoreState = 0;

        using var connection = new SqlConnection(connectionString);
        connection.Open();

        const string checkQueryStoreSql = """
                SELECT actual_state 
                FROM sys.database_query_store_options;
                """;

        try
        {
            using var cmd = new SqlCommand(checkQueryStoreSql, connection);
            var result = cmd.ExecuteScalar();
            if (result != null && result != DBNull.Value)
            {
                queryStoreState = Convert.ToInt16(result);
            }
        }
        catch
        {
            // sys.database_query_store_options pode não existir se versão antiga
        }

        // actual_state == 2 indica READ_WRITE
        if (queryStoreState == 2)
        {
            Console.ForegroundColor = ConsoleColor.DarkGreen;
            Console.WriteLine("   • Observabilidade: Query Store já está ativo em modo READ_WRITE.");
            Console.ResetColor();
            return;
        }

        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine("   • Observabilidade: Ativando Query Store (Auto-Capture & 30 dias retenção)...");
        Console.ResetColor();

        var alterQueryStoreSql = $"""
                ALTER DATABASE [{targetDatabase}] SET QUERY_STORE = ON (
                    OPERATION_MODE = READ_WRITE,
                    CLEANUP_POLICY = (STALE_QUERY_THRESHOLD_DAYS = 30),
                    DATA_FLUSH_INTERVAL_SECONDS = 900,
                    MAX_STORAGE_SIZE_MB = 1024,
                    QUERY_CAPTURE_MODE = AUTO,
                    SIZE_BASED_CLEANUP_MODE = AUTO
                );
                """;

        using var alterCmd = new SqlCommand(alterQueryStoreSql, connection);
        alterCmd.CommandTimeout = 30;
        alterCmd.ExecuteNonQuery();

        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine("   • Observabilidade: ✅ Query Store habilitado com sucesso!");
        Console.ResetColor();
    }
}
