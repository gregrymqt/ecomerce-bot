using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Admin;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Application.Interfaces;

public interface ISaasGrowthService
{
    Task<Guid> RecordSaasVisitAsync(RecordSaasVisitRequestDto request, string? ipAddress, string? userAgent);
    Task<AcquisitionFunnelResponseDto> GetAcquisitionFunnelAsync(int days = 30);
    Task<UnitEconomicsResponseDto> GetUnitEconomicsAsync(int days = 30);
    Task<Guid> CreateAdSpendAsync(CreateAdSpendRequestDto request);
    Task<IEnumerable<SaasAdSpend>> GetAdSpendsAsync(int days = 30);
}
