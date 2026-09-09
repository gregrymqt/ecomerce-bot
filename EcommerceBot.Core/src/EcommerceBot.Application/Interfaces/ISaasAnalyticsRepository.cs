using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Admin;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Application.Interfaces;

public interface ISaasAnalyticsRepository
{
    Task<Guid> RecordVisitAsync(SaasTrafficVisit visit, CancellationToken cancellationToken = default);
    Task<AcquisitionFunnelResponseDto> GetAcquisitionFunnelAsync(int days, CancellationToken cancellationToken = default);
    Task<UnitEconomicsResponseDto> GetUnitEconomicsAsync(int days, CancellationToken cancellationToken = default);
    Task<Guid> CreateAdSpendAsync(SaasAdSpend adSpend, CancellationToken cancellationToken = default);
    Task<IEnumerable<SaasAdSpend>> GetAdSpendsAsync(int days, CancellationToken cancellationToken = default);
}
