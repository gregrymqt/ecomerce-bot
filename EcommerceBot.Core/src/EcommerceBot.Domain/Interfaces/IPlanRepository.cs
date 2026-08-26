using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

public interface IPlanRepository
{
    Task<Plan?> GetByIdAsync(Guid id);
    Task<IEnumerable<Plan>> GetAllAsync(bool onlyActive = false);
    Task<Guid> CreateAsync(Plan plan);
    Task UpdateAsync(Plan plan);
}
