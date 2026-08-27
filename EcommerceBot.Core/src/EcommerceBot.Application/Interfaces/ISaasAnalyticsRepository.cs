using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Admin;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Application.Interfaces;

public interface ISaasAnalyticsRepository
{
    Task<Guid> RecordVisitAsync(SaasTrafficVisit visit);
    Task<AcquisitionFunnelResponseDto> GetAcquisitionFunnelAsync(int days);
    Task<UnitEconomicsResponseDto> GetUnitEconomicsAsync(int days);
    Task<Guid> CreateAdSpendAsync(SaasAdSpend adSpend);
    Task<IEnumerable<SaasAdSpend>> GetAdSpendsAsync(int days);
}
