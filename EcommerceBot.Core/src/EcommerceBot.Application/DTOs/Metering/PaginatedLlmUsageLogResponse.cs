using System.Collections.Generic;

namespace EcommerceBot.Application.DTOs.Metering;

public sealed record PaginatedLlmUsageLogResponse
{
    public IEnumerable<LlmUsageLogResponse> Items { get; init; } = new List<LlmUsageLogResponse>();
    public int Total { get; init; }
    public int Page { get; init; }
    public int Limit { get; init; }
    public int TotalPages { get; init; }
}
