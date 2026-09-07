using System;
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

namespace EcommerceBot.Diagnostics.Mcp.Configurations;

/// <summary>
/// Métodos de extensão para registro de infraestrutura, dependências e ferramentas de diagnóstico MCP.
/// </summary>
public static class McpServiceExtensions
{
    public static IServiceCollection AddMcpDiagnostics(this IServiceCollection services, IConfiguration configuration)
    {
        // 1. Opções fortemente tipadas da infraestrutura
        services.AddAppOptions(configuration);

        // 2. HttpClientFactory para APIs HTTP de infraestrutura (RabbitMQ Management, etc.)
        services.AddHttpClient("RabbitMqManagement", client =>
        {
            client.Timeout = TimeSpan.FromSeconds(4);
        });

        // 3. Fábrica de Conexão SQL Server Dapper (Read-Only)
        services.AddSingleton<IDbConnectionFactory, DbConnectionFactory>();

        // 4. Conexão Redis resiliente (AbortOnConnectFail = false)
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

        // 5. Ferramentas de Diagnóstico do Sistema
        services.AddSingleton<ISystemDiagnosticTool, SqlHealthTool>();
        services.AddSingleton<ISystemDiagnosticTool, RedisMetricsTool>();
        services.AddSingleton<ISystemDiagnosticTool, RabbitMqQueueTool>();
        services.AddSingleton<ISystemDiagnosticTool, ErrorLogReaderTool>();
        services.AddSingleton<ISystemDiagnosticTool, MlModelArtifactsTool>();
        services.AddSingleton<ISystemDiagnosticTool, SparkPipelineStatusTool>();

        // 6. Provedor de Recursos e Servidor MCP
        services.AddSingleton<RunbookResourceProvider>();
        services.AddSingleton<McpServer>();

        return services;
    }
}
