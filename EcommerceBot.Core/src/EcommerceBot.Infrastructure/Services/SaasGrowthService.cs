using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Admin;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

public sealed class SaasGrowthService : ISaasGrowthService
{
    private readonly ISaasAnalyticsRepository _analyticsRepository;
    private readonly ILogger<SaasGrowthService> _logger;

    public SaasGrowthService(
        ISaasAnalyticsRepository analyticsRepository,
        ILogger<SaasGrowthService> logger)
    {
        _analyticsRepository = analyticsRepository;
        _logger = logger;
    }

    public async Task<Guid> RecordSaasVisitAsync(RecordSaasVisitRequestDto request, string? ipAddress, string? userAgent, CancellationToken cancellationToken = default)
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

        try
        {
            return await _analyticsRepository.RecordVisitAsync(visit, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha não-bloqueante ao registrar visita de tráfego SaaS (SessionId: {SessionId})", visit.SessionId);
            return Guid.Empty;
        }
    }

    public async Task<AcquisitionFunnelResponseDto> GetAcquisitionFunnelAsync(int days = 30, CancellationToken cancellationToken = default)
    {
        try
        {
            return await _analyticsRepository.GetAcquisitionFunnelAsync(days, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao obter funil de aquisição SaaS (dias: {Days})", days);
            throw;
        }
    }

    public async Task<UnitEconomicsResponseDto> GetUnitEconomicsAsync(int days = 30, CancellationToken cancellationToken = default)
    {
        try
        {
            return await _analyticsRepository.GetUnitEconomicsAsync(days, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao obter unit economics SaaS (dias: {Days})", days);
            throw;
        }
    }

    public async Task<Guid> CreateAdSpendAsync(CreateAdSpendRequestDto request, CancellationToken cancellationToken = default)
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

        try
        {
            return await _analyticsRepository.CreateAdSpendAsync(adSpend, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao registrar investimento em anúncios (Campanha: {CampaignName})", request.CampaignName);
            throw;
        }
    }

    public async Task<IEnumerable<SaasAdSpend>> GetAdSpendsAsync(int days = 30, CancellationToken cancellationToken = default)
    {
        try
        {
            return await _analyticsRepository.GetAdSpendsAsync(days, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao consultar investimentos em anúncios (dias: {Days})", days);
            throw;
        }
    }
}
