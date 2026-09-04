using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Diagnostics.Mcp.Protocol;

namespace EcommerceBot.Diagnostics.Mcp.Tools;

public interface ISystemDiagnosticTool
{
    string Name { get; }
    string Description { get; }
    object InputSchema { get; }
    Task<McpToolCallResult> ExecuteAsync(JsonElement? arguments);
}
