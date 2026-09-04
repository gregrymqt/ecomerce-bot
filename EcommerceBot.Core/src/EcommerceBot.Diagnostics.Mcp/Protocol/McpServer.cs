using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Diagnostics.Mcp.Resources;
using EcommerceBot.Diagnostics.Mcp.Tools;

namespace EcommerceBot.Diagnostics.Mcp.Protocol;

/// <summary>
/// Servidor MCP padrão via stdio (Standard I/O).
/// Processa requisições JSON-RPC 2.0 recebidas na stdin e responde na stdout.
/// Todos os logs de telemetria/diagnóstico são enviados para stderr.
/// </summary>
public class McpServer
{
    private readonly Dictionary<string, ISystemDiagnosticTool> _tools;
    private readonly RunbookResourceProvider _resourceProvider;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public McpServer(IEnumerable<ISystemDiagnosticTool> tools, RunbookResourceProvider resourceProvider)
    {
        _tools = tools.ToDictionary(t => t.Name, StringComparer.OrdinalIgnoreCase);
        _resourceProvider = resourceProvider;
    }

    public async Task RunAsync(CancellationToken cancellationToken = default)
    {
        Console.Error.WriteLine("🚀 [EcommerceBot.Diagnostics.Mcp] Servidor MCP iniciado via stdio.");
        Console.Error.WriteLine($"📋 Ferramentas registradas: {string.Join(", ", _tools.Keys)}");

        using var reader = new StreamReader(Console.OpenStandardInput());

        while (!cancellationToken.IsCancellationRequested)
        {
            var line = await reader.ReadLineAsync(cancellationToken);
            if (line == null)
            {
                // EOF alcançado (o cliente fechou a conexão stdin)
                break;
            }

            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            try
            {
                var response = await ProcessMessageAsync(line);
                if (response != null)
                {
                    var json = JsonSerializer.Serialize(response, JsonOptions);
                    Console.WriteLine(json);
                    Console.Out.Flush();
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"❌ Erro ao processar mensagem JSON-RPC: {ex.Message}");
            }
        }

        Console.Error.WriteLine("🛑 [EcommerceBot.Diagnostics.Mcp] Servidor MCP finalizado.");
    }

    private async Task<JsonRpcResponse?> ProcessMessageAsync(string rawJson)
    {
        JsonRpcRequest? request;
        try
        {
            request = JsonSerializer.Deserialize<JsonRpcRequest>(rawJson, JsonOptions);
        }
        catch (Exception ex)
        {
            return new JsonRpcResponse
            {
                Id = null,
                Error = new JsonRpcError { Code = -32700, Message = $"Parse error: {ex.Message}" }
            };
        }

        if (request == null) return null;

        // Notificações (sem id) não exigem resposta
        if (request.Id == null && request.Method.StartsWith("notifications/", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return request.Method.ToLowerInvariant() switch
        {
            "initialize" => HandleInitialize(request),
            "ping" => new JsonRpcResponse { Id = request.Id, Result = new { } },
            "tools/list" => HandleToolsList(request),
            "tools/call" => await HandleToolsCallAsync(request),
            "resources/list" => HandleResourcesList(request),
            "resources/read" => HandleResourcesRead(request),
            _ => new JsonRpcResponse
            {
                Id = request.Id,
                Error = new JsonRpcError
                {
                    Code = -32601,
                    Message = $"Method not found: {request.Method}"
                }
            }
        };
    }

    private JsonRpcResponse HandleInitialize(JsonRpcRequest request)
    {
        var result = new McpInitializeResult();
        return new JsonRpcResponse
        {
            Id = request.Id,
            Result = result
        };
    }

    private JsonRpcResponse HandleToolsList(JsonRpcRequest request)
    {
        var toolsList = _tools.Values.Select(t => new McpToolDefinition
        {
            Name = t.Name,
            Description = t.Description,
            InputSchema = t.InputSchema
        }).ToList();

        return new JsonRpcResponse
        {
            Id = request.Id,
            Result = new { tools = toolsList }
        };
    }

    private async Task<JsonRpcResponse> HandleToolsCallAsync(JsonRpcRequest request)
    {
        if (!request.Params.HasValue)
        {
            return new JsonRpcResponse
            {
                Id = request.Id,
                Error = new JsonRpcError { Code = -32602, Message = "Missing params for tools/call" }
            };
        }

        var paramsElement = request.Params.Value;
        if (!paramsElement.TryGetProperty("name", out var nameProp))
        {
            return new JsonRpcResponse
            {
                Id = request.Id,
                Error = new JsonRpcError { Code = -32602, Message = "Tool name required" }
            };
        }

        var toolName = nameProp.GetString() ?? string.Empty;
        if (!_tools.TryGetValue(toolName, out var tool))
        {
            return new JsonRpcResponse
            {
                Id = request.Id,
                Error = new JsonRpcError { Code = -32602, Message = $"Tool not found: {toolName}" }
            };
        }

        JsonElement? arguments = paramsElement.TryGetProperty("arguments", out var argsProp) ? argsProp : null;
        Console.Error.WriteLine($"⚡ Executando ferramenta MCP: {toolName}");

        var toolResult = await tool.ExecuteAsync(arguments);

        return new JsonRpcResponse
        {
            Id = request.Id,
            Result = toolResult
        };
    }

    private JsonRpcResponse HandleResourcesList(JsonRpcRequest request)
    {
        var resources = _resourceProvider.ListResources();
        return new JsonRpcResponse
        {
            Id = request.Id,
            Result = new { resources }
        };
    }

    private JsonRpcResponse HandleResourcesRead(JsonRpcRequest request)
    {
        if (!request.Params.HasValue || !request.Params.Value.TryGetProperty("uri", out var uriProp))
        {
            return new JsonRpcResponse
            {
                Id = request.Id,
                Error = new JsonRpcError { Code = -32602, Message = "URI parameter required" }
            };
        }

        var uri = uriProp.GetString() ?? string.Empty;
        var readResult = _resourceProvider.ReadResource(uri);

        if (readResult == null)
        {
            return new JsonRpcResponse
            {
                Id = request.Id,
                Error = new JsonRpcError { Code = -32602, Message = $"Resource not found: {uri}" }
            };
        }

        return new JsonRpcResponse
        {
            Id = request.Id,
            Result = readResult
        };
    }
}
