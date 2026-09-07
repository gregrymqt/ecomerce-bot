using System;
using System.IO;
using System.Text;
using EcommerceBot.Diagnostics.Mcp.Configurations;
using EcommerceBot.Diagnostics.Mcp.Protocol;
using EcommerceBot.Infrastructure.Configurations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

// Configurar fluxos de entrada/saída padrão com UTF-8 sem BOM (obrigatório para JSON-RPC stdio)
Console.OutputEncoding = new UTF8Encoding(false);
Console.InputEncoding = new UTF8Encoding(false);

var configuration = new ConfigurationBuilder()
    .SetBasePath(Directory.GetCurrentDirectory())
    .AddDotEnvConfiguration()
    .Build();

var services = new ServiceCollection();
services.AddMcpDiagnostics(configuration);

var serviceProvider = services.BuildServiceProvider();
var mcpServer = serviceProvider.GetRequiredService<McpServer>();

await mcpServer.RunAsync();
