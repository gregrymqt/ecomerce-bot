using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Plans;

namespace EcommerceBot.Application.Interfaces;

public interface IPlanService
{
    Task<PlanResponse?> GetPlanByIdAsync(Guid id);
    Task<IEnumerable<PlanResponse>> GetAllPlansAsync(bool onlyActive = false);
    Task<PlanResponse> CreatePlanAsync(CreatePlanRequest request);
    Task<PlanResponse?> UpdatePlanAsync(Guid id, UpdatePlanRequest request);
}
