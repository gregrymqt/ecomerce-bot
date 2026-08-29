using System;
using System.Collections.Generic;

namespace EcommerceBot.Application.DTOs.Admin
{
    public class EnterpriseLeadAdminDto
    {
        public Guid Id { get; set; }
        public string Email { get; set; } = string.Empty;
        public string? CompanyName { get; set; }
        public string? JobTitle { get; set; }
        public string? ExpectedVolume { get; set; }
        public string? Phone { get; set; }
        public string? TeamSize { get; set; }
        public string? Notes { get; set; }
        public string Status { get; set; } = "PENDING";
        public string? InternalNotes { get; set; }
        public Guid? ConvertedTenantId { get; set; }
        public Guid? ConvertedUserId { get; set; }
        public string? IpAddress { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }

    public class EnterpriseLeadsSummaryMetrics
    {
        public int TotalLeads { get; set; }
        public int PendingCount { get; set; }
        public int ContactedCount { get; set; }
        public int QualifiedCount { get; set; }
        public int ConvertedCount { get; set; }
        public int RejectedCount { get; set; }
    }

    public class EnterpriseLeadsListResponse
    {
        public List<EnterpriseLeadAdminDto> Leads { get; set; } = new();
        public EnterpriseLeadsSummaryMetrics Metrics { get; set; } = new();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
    }

    public class UpdateEnterpriseLeadStatusRequest
    {
        public string Status { get; set; } = string.Empty;
        public string? InternalNotes { get; set; }
    }

    public class ProvisionEnterpriseAccountRequest
    {
        public string? TenantName { get; set; }
        public string? AdminFullName { get; set; }
        public string? TemporaryPassword { get; set; }
        public int CreditsBalance { get; set; } = 50000;
        public decimal ManagedCreditBalance { get; set; } = 100.00m;
        public bool IsByok { get; set; } = false;
        public string? InternalNotes { get; set; }
    }

    public class ProvisionEnterpriseAccountResponse
    {
        public Guid LeadId { get; set; }
        public Guid TenantId { get; set; }
        public Guid UserId { get; set; }
        public string TenantName { get; set; } = string.Empty;
        public string AdminEmail { get; set; } = string.Empty;
        public string PlanTier { get; set; } = "ENTERPRISE";
        public int CreditsBalance { get; set; }
        public string Status { get; set; } = "CONVERTED";
        public string Message { get; set; } = string.Empty;
    }
}
