using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Admin;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Services;

public class SaasGrowthService : ISaasGrowthService
{
    private readonly ISaasAnalyticsRepository _analyticsRepository;

    public SaasGrowthService(ISaasAnalyticsRepository analyticsRepository)
    {
        _analyticsRepository = analyticsRepository;
    }

    public async Task<Guid> RecordSaasVisitAsync(RecordSaasVisitRequestDto request, string? ipAddress, string? userAgent)
    {
        var visit = new SaasTrafficVisit
        {
            Id = Guid.NewGuid(),
            SessionId = string.IsNullOrWhiteSpace(request.SessionId) ? Guid.NewGuid().ToString("N") : request.SessionId,
            Path = string.IsNullOrWhiteSpace(request.Path) ? "/" : request.Path,
            UtmSource = request.UtmSource,
            UtmMedium = request.UtmMedium,
            UtmCampaign = request.UtmCampaign,
            UtmContent = request.UtmContent,
            UtmTerm = request.UtmTerm,
            AdId = request.AdId,
            FbClid = request.FbClid,
            GClid = request.GClid,
            Referrer = request.Referrer,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            CreatedAt = DateTimeOffset.UtcNow
        };

        return await _analyticsRepository.RecordVisitAsync(visit);
    }

    public async Task<AcquisitionFunnelResponseDto> GetAcquisitionFunnelAsync(int days = 30)
    {
        return await _analyticsRepository.GetAcquisitionFunnelAsync(days);
    }

    public async Task<UnitEconomicsResponseDto> GetUnitEconomicsAsync(int days = 30)
    {
        return await _analyticsRepository.GetUnitEconomicsAsync(days);
    }

    public async Task<Guid> CreateAdSpendAsync(CreateAdSpendRequestDto request)
    {
        var adSpend = new SaasAdSpend
        {
            Id = Guid.NewGuid(),
            CampaignName = request.CampaignName,
            UtmSource = request.UtmSource,
            AdId = request.AdId,
            AmountSpentBrl = request.AmountSpentBrl,
            PeriodStart = request.PeriodStart,
            PeriodEnd = request.PeriodEnd,
            Notes = request.Notes,
            CreatedAt = DateTimeOffset.UtcNow
        };

        return await _analyticsRepository.CreateAdSpendAsync(adSpend);
    }

    public async Task<IEnumerable<SaasAdSpend>> GetAdSpendsAsync(int days = 30)
    {
        return await _analyticsRepository.GetAdSpendsAsync(days);
    }
}
