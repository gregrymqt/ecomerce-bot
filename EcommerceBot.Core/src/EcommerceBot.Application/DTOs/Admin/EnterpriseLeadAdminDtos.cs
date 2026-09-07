using System;
using System.Collections.Generic;

namespace EcommerceBot.Application.DTOs.Admin;

public sealed record EnterpriseLeadAdminDto
{
    public Guid Id { get; init; }
    public string Email { get; init; } = string.Empty;
    public string? CompanyName { get; init; }
    public string? JobTitle { get; init; }
    public string? ExpectedVolume { get; init; }
    public string? Phone { get; init; }
    public string? TeamSize { get; init; }
    public string? Notes { get; init; }
    public string Status { get; init; } = "PENDING";
    public string? InternalNotes { get; init; }
    public Guid? ConvertedTenantId { get; init; }
    public Guid? ConvertedUserId { get; init; }
    public string? IpAddress { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}

public sealed record EnterpriseLeadsSummaryMetrics
{
    public int TotalLeads { get; init; }
    public int PendingCount { get; init; }
    public int ContactedCount { get; init; }
    public int QualifiedCount { get; init; }
    public int ConvertedCount { get; init; }
    public int RejectedCount { get; init; }
}

public sealed record EnterpriseLeadsListResponse
{
    public List<EnterpriseLeadAdminDto> Leads { get; init; } = new();
    public EnterpriseLeadsSummaryMetrics Metrics { get; init; } = new();
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
}

public sealed record UpdateEnterpriseLeadStatusRequest
{
    public string Status { get; init; } = string.Empty;
    public string? InternalNotes { get; init; }
}

public sealed record ProvisionEnterpriseAccountRequest
{
    public string? TenantName { get; init; }
    public string? AdminFullName { get; init; }
    public string? TemporaryPassword { get; init; }
    public int CreditsBalance { get; init; } = 50000;
    public decimal ManagedCreditBalance { get; init; } = 100.00m;
    public bool IsByok { get; init; } = false;
    public string? InternalNotes { get; init; }
}

public sealed record ProvisionEnterpriseAccountResponse
{
    public Guid LeadId { get; init; }
    public Guid TenantId { get; init; }
    public Guid UserId { get; init; }
    public string TenantName { get; init; } = string.Empty;
    public string AdminEmail { get; init; } = string.Empty;
    public string PlanTier { get; init; } = "ENTERPRISE";
    public int CreditsBalance { get; init; }
    public string Status { get; init; } = "CONVERTED";
    public string Message { get; init; } = string.Empty;
}
