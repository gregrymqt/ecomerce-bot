using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace EcommerceBot.Diagnostics.Mcp.Protocol;

public sealed record JsonRpcRequest
{
    [JsonPropertyName("jsonrpc")]
    public string JsonRpc { get; init; } = "2.0";

    [JsonPropertyName("id")]
    public object? Id { get; init; }

    [JsonPropertyName("method")]
    public string Method { get; init; } = string.Empty;

    [JsonPropertyName("params")]
    public JsonElement? Params { get; init; }
}

public sealed record JsonRpcResponse
{
    [JsonPropertyName("jsonrpc")]
    public string JsonRpc { get; init; } = "2.0";

    [JsonPropertyName("id")]
    public object? Id { get; init; }

    [JsonPropertyName("result")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public object? Result { get; init; }

    [JsonPropertyName("error")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public JsonRpcError? Error { get; init; }
}

public sealed record JsonRpcError
{
    [JsonPropertyName("code")]
    public int Code { get; init; }

    [JsonPropertyName("message")]
    public string Message { get; init; } = string.Empty;

    [JsonPropertyName("data")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public object? Data { get; init; }
}

public sealed record McpServerInfo
{
    [JsonPropertyName("name")]
    public string Name { get; init; } = "ecommercebot-diagnostics-mcp";

    [JsonPropertyName("version")]
    public string Version { get; init; } = "1.0.0";
}

public sealed record McpCapabilities
{
    [JsonPropertyName("tools")]
    public Dictionary<string, object> Tools { get; init; } = new();

    [JsonPropertyName("resources")]
    public Dictionary<string, object> Resources { get; init; } = new();
}

public sealed record McpInitializeResult
{
    [JsonPropertyName("protocolVersion")]
    public string ProtocolVersion { get; init; } = "2024-11-05";

    [JsonPropertyName("capabilities")]
    public McpCapabilities Capabilities { get; init; } = new();

    [JsonPropertyName("serverInfo")]
    public McpServerInfo ServerInfo { get; init; } = new();
}

public sealed record McpToolDefinition
{
    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("description")]
    public string Description { get; init; } = string.Empty;

    [JsonPropertyName("inputSchema")]
    public object InputSchema { get; init; } = new
    {
        type = "object",
        properties = new Dictionary<string, object>()
    };
}

public sealed record McpContentItem
{
    [JsonPropertyName("type")]
    public string Type { get; init; } = "text";

    [JsonPropertyName("text")]
    public string Text { get; init; } = string.Empty;
}

public sealed record McpToolCallResult
{
    [JsonPropertyName("content")]
    public List<McpContentItem> Content { get; init; } = new();

    [JsonPropertyName("isError")]
    public bool IsError { get; init; }
}

public sealed record McpResourceDefinition
{
    [JsonPropertyName("uri")]
    public string Uri { get; init; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Description { get; init; }

    [JsonPropertyName("mimeType")]
    public string MimeType { get; init; } = "text/markdown";
}

public sealed record McpResourceContent
{
    [JsonPropertyName("uri")]
    public string Uri { get; init; } = string.Empty;

    [JsonPropertyName("mimeType")]
    public string MimeType { get; init; } = "text/markdown";

    [JsonPropertyName("text")]
    public string Text { get; init; } = string.Empty;
}

public sealed record McpResourceReadResult
{
    [JsonPropertyName("contents")]
    public List<McpResourceContent> Contents { get; init; } = new();
}
