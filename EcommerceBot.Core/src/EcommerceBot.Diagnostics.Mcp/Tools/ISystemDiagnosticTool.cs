using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Diagnostics.Mcp.Protocol;

namespace EcommerceBot.Diagnostics.Mcp.Tools;

/// <summary>
/// Contrato unificado para ferramentas de diagnóstico do sistema expostas via Model Context Protocol (MCP).
/// </summary>
public interface ISystemDiagnosticTool
{
    string Name { get; }
    string Description { get; }
    object InputSchema { get; }
    Task<McpToolCallResult> ExecuteAsync(JsonElement? arguments, CancellationToken cancellationToken = default);
}
