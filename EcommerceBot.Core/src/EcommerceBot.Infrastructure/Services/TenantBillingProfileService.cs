using System;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Billing;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Application.Security;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

/// <summary>
/// Serviço de domínio/aplicação para validação e orquestração do perfil de faturamento do Tenant.
/// </summary>
public sealed class TenantBillingProfileService : ITenantBillingProfileService
{
    private readonly ITenantBillingProfileRepository _repository;
    private readonly ILogger<TenantBillingProfileService> _logger;

    public TenantBillingProfileService(
        ITenantBillingProfileRepository repository,
        ILogger<TenantBillingProfileService> logger)
    {
        _repository = repository ?? throw new ArgumentNullException(nameof(repository));
        _logger = logger;
    }

    public async Task<TenantBillingProfileResponse?> GetProfileAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        if (tenantId == Guid.Empty) return null;

        try
        {
            var entity = await _repository.GetByTenantIdAsync(tenantId, cancellationToken);
            return entity is null ? null : MapToResponse(entity);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao consultar perfil de faturamento para o Tenant {TenantId}", tenantId);
            return null;
        }
    }

    public async Task<TenantBillingProfileResponse> UpsertProfileAsync(
        Guid tenantId, 
        UpsertTenantBillingProfileRequest request, 
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (tenantId == Guid.Empty) throw new ArgumentException("TenantId é obrigatório.", nameof(tenantId));

        var cleanDoc = DocumentValidator.Sanitize(request.DocumentNumber);
        var docType = request.DocumentType?.Trim().ToUpperInvariant() ?? (cleanDoc.Length == 14 ? "CNPJ" : "CPF");

        if (!DocumentValidator.IsValid(cleanDoc, docType))
        {
            throw new ArgumentException($"O documento informado não é um {docType} válido.");
        }

        var cleanZip = DocumentValidator.Sanitize(request.ZipCode);
        if (cleanZip.Length != 8)
        {
            throw new ArgumentException("O CEP informado deve conter 8 dígitos numéricos.");
        }

        var entity = new TenantBillingProfile
        {
            TenantId = tenantId,
            LegalName = request.LegalName.Trim(),
            TradeName = string.IsNullOrWhiteSpace(request.TradeName) ? null : request.TradeName.Trim(),
            DocumentType = docType,
            DocumentNumber = cleanDoc,
            Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim().ToLowerInvariant(),
            Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
            ZipCode = cleanZip,
            StreetName = request.StreetName.Trim(),
            StreetNumber = request.StreetNumber.Trim(),
            Complement = string.IsNullOrWhiteSpace(request.Complement) ? null : request.Complement.Trim(),
            Neighborhood = request.Neighborhood.Trim(),
            City = request.City.Trim(),
            FederalUnit = request.FederalUnit.Trim().ToUpperInvariant()
        };

        try
        {
            var saved = await _repository.UpsertAsync(entity, cancellationToken);
            _logger.LogInformation("Perfil de faturamento salvo com sucesso para o Tenant {TenantId}.", tenantId);
            return MapToResponse(saved);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao realizar upsert do perfil de faturamento para o Tenant {TenantId}, Documento: {DocumentNumber}", tenantId, cleanDoc);
            throw;
        }
    }

    private static TenantBillingProfileResponse MapToResponse(TenantBillingProfile entity)
    {
        return new TenantBillingProfileResponse
        {
            Id = entity.Id,
            TenantId = entity.TenantId,
            LegalName = entity.LegalName,
            TradeName = entity.TradeName,
            DocumentType = entity.DocumentType,
            DocumentNumber = entity.DocumentNumber,
            DocumentNumberMasked = MaskDocument(entity.DocumentNumber, entity.DocumentType),
            Email = entity.Email,
            Phone = entity.Phone,
            ZipCode = entity.ZipCode,
            StreetName = entity.StreetName,
            StreetNumber = entity.StreetNumber,
            Complement = entity.Complement,
            Neighborhood = entity.Neighborhood,
            City = entity.City,
            FederalUnit = entity.FederalUnit,
            UpdatedAt = entity.UpdatedAt
        };
    }

    private static string MaskDocument(string? document, string type)
    {
        if (string.IsNullOrWhiteSpace(document)) return string.Empty;
        var digits = DocumentValidator.Sanitize(document);

        if (type.Equals("CPF", StringComparison.OrdinalIgnoreCase) && digits.Length == 11)
        {
            // Ex: 123.***.***-09
            return $"{digits[..3]}.***.***-{digits[9..]}";
        }

        if (type.Equals("CNPJ", StringComparison.OrdinalIgnoreCase) && digits.Length == 14)
        {
            // Ex: 12.***.***/0001-34
            return $"{digits[..2]}.***.***/{digits[8..12]}-{digits[12..]}";
        }

        return digits.Length > 4 ? $"***{digits[^4..]}" : digits;
    }
}
