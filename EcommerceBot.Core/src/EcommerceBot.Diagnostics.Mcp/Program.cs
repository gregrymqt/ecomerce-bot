using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using EcommerceBot.Diagnostics.Mcp.Protocol;
using EcommerceBot.Diagnostics.Mcp.Resources;
using EcommerceBot.Diagnostics.Mcp.Tools;
using EcommerceBot.Domain.Interfaces;
using EcommerceBot.Infrastructure.Configurations;
using EcommerceBot.Infrastructure.Data;
using EcommerceBot.Infrastructure.Options;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

// Configurar saída padrão UTF-8 sem BOM
Console.OutputEncoding = new UTF8Encoding(false);
Console.InputEncoding = new UTF8Encoding(false);

var configurationBuilder = new ConfigurationBuilder()
    .SetBasePath(Directory.GetCurrentDirectory())
    .AddDotEnvConfiguration();

var configuration = configurationBuilder.Build();

var services = new ServiceCollection();

// 1. Opções fortemente tipadas
services.AddAppOptions(configuration);

// 2. Fábrica de Conexão SQL Server Dapper
services.AddSingleton<IDbConnectionFactory, DbConnectionFactory>();

// 3. Conexão Redis resiliente (AbortOnConnectFail = false)
services.AddSingleton<IConnectionMultiplexer>(sp =>
{
    var redisOptions = sp.GetRequiredService<IOptions<RedisOptions>>().Value;
    var connStr = !string.IsNullOrWhiteSpace(redisOptions.ConnectionString) 
        ? redisOptions.ConnectionString 
        : "localhost:6379";

    var config = ConfigurationOptions.Parse(connStr);
    config.AbortOnConnectFail = false;
    config.ConnectTimeout = 3000;
    config.AsyncTimeout = 3000;

    if (!string.IsNullOrWhiteSpace(redisOptions.Password))
    {
        config.Password = redisOptions.Password;
    }

    return ConnectionMultiplexer.Connect(config);
});

// 4. Ferramentas de Diagnóstico
services.AddSingleton<ISystemDiagnosticTool, SqlHealthTool>();
services.AddSingleton<ISystemDiagnosticTool, RedisMetricsTool>();
services.AddSingleton<ISystemDiagnosticTool, RabbitMqQueueTool>();
services.AddSingleton<ISystemDiagnosticTool, ErrorLogReaderTool>();

// 5. Provedor de Recursos (Runbooks) & Servidor MCP
services.AddSingleton<RunbookResourceProvider>();
services.AddSingleton<McpServer>();

var serviceProvider = services.BuildServiceProvider();

var mcpServer = serviceProvider.GetRequiredService<McpServer>();
await mcpServer.RunAsync();
