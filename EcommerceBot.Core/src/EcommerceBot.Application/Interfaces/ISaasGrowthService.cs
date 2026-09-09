using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Admin;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Application.Interfaces;

public interface ISaasGrowthService
{
    Task<Guid> RecordSaasVisitAsync(RecordSaasVisitRequestDto request, string? ipAddress, string? userAgent, CancellationToken cancellationToken = default);
    Task<AcquisitionFunnelResponseDto> GetAcquisitionFunnelAsync(int days = 30, CancellationToken cancellationToken = default);
    Task<UnitEconomicsResponseDto> GetUnitEconomicsAsync(int days = 30, CancellationToken cancellationToken = default);
    Task<Guid> CreateAdSpendAsync(CreateAdSpendRequestDto request, CancellationToken cancellationToken = default);
    Task<IEnumerable<SaasAdSpend>> GetAdSpendsAsync(int days = 30, CancellationToken cancellationToken = default);
}
