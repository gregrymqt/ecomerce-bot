using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Plans;

namespace EcommerceBot.Application.Interfaces;

public interface IPlanService
{
    Task<PlanResponse?> GetPlanByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IEnumerable<PlanResponse>> GetAllPlansAsync(bool onlyActive = false, CancellationToken cancellationToken = default);
    Task<PlanResponse> CreatePlanAsync(CreatePlanRequest request, CancellationToken cancellationToken = default);
    Task<PlanResponse?> UpdatePlanAsync(Guid id, UpdatePlanRequest request, CancellationToken cancellationToken = default);
}
