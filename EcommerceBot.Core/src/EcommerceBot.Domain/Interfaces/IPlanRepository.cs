using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

public interface IPlanRepository
{
    Task<Plan?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IEnumerable<Plan>> GetAllAsync(bool onlyActive = false, CancellationToken cancellationToken = default);
    Task<Guid> CreateAsync(Plan plan, CancellationToken cancellationToken = default);
    Task UpdateAsync(Plan plan, CancellationToken cancellationToken = default);
}
