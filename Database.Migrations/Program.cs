using System.Reflection;
using DbUp;
using Microsoft.Extensions.Configuration;

namespace Database.Migrations;

public class Program
{
    public static int Main(string[] args)
    {
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine("====================================================================");
        Console.WriteLine("  🚀 E-commerce Bot — DbUp PostgreSQL Migration Engine (.NET 9)");
        Console.WriteLine("====================================================================");
        Console.ResetColor();

        // 0. Carrega variáveis de ambiente a partir do arquivo .env caso exista
        DotEnvHelper.Load();

        // 1. Build configuration to read Environment Variables and CLI arguments
        var configuration = new ConfigurationBuilder()
            .AddEnvironmentVariables()
            .AddCommandLine(args)
            .Build();

        // 2. Resolve Connection String (CLI arg -> Env Var -> Default Dev)
        string? connectionString = null;
        if (args.Length > 0 && !args[0].StartsWith("--"))
        {
            connectionString = args[0];
        }
        else
        {
            connectionString = configuration["POSTGRES_CONNECTION_STRING"] 
                               ?? configuration["connectionString"]
                               ?? configuration["DATABASE_URL"];

            var fallback = configuration["ConnectionStrings:DefaultConnection"];
            if (string.IsNullOrWhiteSpace(connectionString) && !string.IsNullOrWhiteSpace(fallback))
            {
                // Verifica se não é formato legado do SQL Server
                if (!fallback.Contains("Server=", StringComparison.OrdinalIgnoreCase) &&
                    !fallback.Contains("Encrypt=", StringComparison.OrdinalIgnoreCase))
                {
                    connectionString = fallback;
                }
            }
        }

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            connectionString = "Host=127.0.0.1;Port=5432;Database=ecommerce_bot_db;Username=postgres;Password=postgres;";
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine($"⚠️ Nenhuma connection string PostgreSQL informada. Utilizando padrão local de desenvolvimento: {connectionString}");
            Console.ResetColor();
        }

        try
        {
            // 3. Ensure target database exists
            Console.WriteLine("🔍 Verificando/Criando banco de dados de destino...");
            try
            {
                EnsureDatabase.For.PostgresqlDatabase(connectionString);
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("✅ Banco de dados pronto.");
                Console.ResetColor();
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine($"ℹ️ EnsureDatabase: {ex.Message} (Prosseguindo caso o banco já tenha sido provisionado).");
                Console.ResetColor();
            }

            // 3.1 Configure Extensions & Observability
            DatabaseConfigurationHelper.ConfigureDatabaseOptions(connectionString);

            // 4. Configure DbUp Upgrade Engine
            Console.WriteLine("📦 Descobrindo scripts versionados embutidos no assembly...");
            var upgrader = DeployChanges.To
                .PostgresqlDatabase(connectionString)
                .WithScriptsEmbeddedInAssembly(Assembly.GetExecutingAssembly())
                .WithVariablesDisabled()
                .LogToConsole()
                .WithTransactionPerScript()
                .Build();

            // 5. Check if there are pending scripts
            var scriptsToExecute = upgrader.GetScriptsToExecute();
            Console.WriteLine($"ℹ️ Scripts pendentes para execução: {scriptsToExecute.Count}");

            if (scriptsToExecute.Count == 0)
            {
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("✨ O banco de dados já está 100% atualizado. Nenhuma migração pendente.");
                Console.ResetColor();
                return 0;
            }

            foreach (var script in scriptsToExecute)
            {
                Console.WriteLine($"   • {script.Name}");
            }

            // 6. Execute Upgrade
            Console.WriteLine("\n🚀 Executando migrações SQL (PostgreSQL)...");
            var result = upgrader.PerformUpgrade();

            if (!result.Successful)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("\n❌ ERRO durante a execução da migração:");
                Console.WriteLine(result.Error);
                Console.ResetColor();
                return -1;
            }

            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("\n🎉 Todas as migrações foram executadas com sucesso!");
            Console.ResetColor();
            return 0;
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"\n❌ Falha fatal ao executar migrações: {ex.Message}");
            Console.WriteLine(ex.StackTrace);
            Console.ResetColor();
            return -1;
        }
    }
}
