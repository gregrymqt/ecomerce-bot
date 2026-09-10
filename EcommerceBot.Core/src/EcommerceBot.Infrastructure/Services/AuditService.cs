using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

/// <summary>
/// Serviço de auditoria imutável e governança LGPD (Art. 18 - Direito ao Esquecimento).
/// </summary>
public sealed class AuditService : IAuditService
{
    private readonly IAuditRepository _auditRepository;
    private readonly ITenantContext _tenantContext;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly IRedisService _redisService;
    private readonly ILogger<AuditService> _logger;

    public AuditService(
        IAuditRepository auditRepository,
        ITenantContext tenantContext,
        IHttpContextAccessor httpContextAccessor,
        IDbConnectionFactory connectionFactory,
        IRedisService redisService,
        ILogger<AuditService> logger)
    {
        _auditRepository = auditRepository ?? throw new ArgumentNullException(nameof(auditRepository));
        _tenantContext = tenantContext ?? throw new ArgumentNullException(nameof(tenantContext));
        _httpContextAccessor = httpContextAccessor ?? throw new ArgumentNullException(nameof(httpContextAccessor));
        _connectionFactory = connectionFactory ?? throw new ArgumentNullException(nameof(connectionFactory));
        _redisService = redisService ?? throw new ArgumentNullException(nameof(redisService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task LogEventAsync(
        string action,
        string entityName,
        string? entityId = null,
        string? oldValuesJson = null,
        string? newValuesJson = null,
        CancellationToken cancellationToken = default)
    {
        var tenantId = _tenantContext.HasTenant ? _tenantContext.TenantId : Guid.Empty;
        var httpContext = _httpContextAccessor.HttpContext;

        Guid? userId = null;
        string? ipAddress = null;
        string? userAgent = null;

        if (httpContext != null)
        {
            var userIdClaim = httpContext.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? httpContext.User?.FindFirst("sub")?.Value;

            if (Guid.TryParse(userIdClaim, out var parsedUserId))
            {
                userId = parsedUserId;
            }

            ipAddress = httpContext.Connection.RemoteIpAddress?.ToString();
            userAgent = httpContext.Request.Headers["User-Agent"].ToString();
            if (userAgent.Length > 500)
            {
                userAgent = userAgent.Substring(0, 500);
            }
        }

        if (tenantId == Guid.Empty)
        {
            _logger.LogWarning("Tentativa de registrar log de auditoria '{Action}' sem TenantId associado. Ignorando.", action);
            return;
        }

        var log = new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = userId,
            Action = action,
            EntityName = entityName,
            EntityId = entityId,
            OldValuesJson = oldValuesJson,
            NewValuesJson = newValuesJson,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            CreatedAt = DateTimeOffset.UtcNow
        };

        try
        {
            await _auditRepository.CreateAsync(log, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Falha ao persistir log de auditoria '{Action}' para o Tenant '{TenantId}'.", action, tenantId);
        }
    }

    public async Task<IEnumerable<AuditLog>> GetAuditTrailAsync(
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        if (!_tenantContext.HasTenant)
        {
            throw new InvalidOperationException("TenantId é obrigatório para consultar a trilha de auditoria.");
        }

        return await _auditRepository.GetByTenantAsync(_tenantContext.TenantId, page, pageSize, cancellationToken);
    }

    public async Task ExecuteRightToBeForgottenAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("TenantId inválido para expurgo LGPD.", nameof(tenantId));
        }

        _logger.LogInformation("Iniciando processo de anonimização e Direito ao Esquecimento (LGPD Art. 18) para o Tenant {TenantId}.", tenantId);

        using var connection = await _connectionFactory.CreateConnectionAsync(tenantId, cancellationToken);

        // Anonimização de usuários do Tenant
        const string anonymizeUsersSql = @"
            UPDATE dbo.Users
            SET FullName = 'Usuário Anonimizado (LGPD)',
                Email = CONCAT('anonimizado-', Id, '@lgpd.removido.local'),
                PasswordHash = 'REVOKED_LGPD',
                IsActive = 0,
                UpdatedAt = SYSDATETIMEOFFSET()
            WHERE TenantId = @TenantId;";

        var userCmd = new CommandDefinition(anonymizeUsersSql, new { TenantId = tenantId }, cancellationToken: cancellationToken);
        await connection.ExecuteAsync(userCmd);

        // Inativação do Tenant
        const string inactivateTenantSql = @"
            UPDATE dbo.Tenants
            SET Name = 'Tenant Anonimizado (LGPD)',
                IsActive = 0,
                UpdatedAt = SYSDATETIMEOFFSET()
            WHERE Id = @TenantId;";

        var tenantCmd = new CommandDefinition(inactivateTenantSql, new { TenantId = tenantId }, cancellationToken: cancellationToken);
        await connection.ExecuteAsync(tenantCmd);

        // Expurgo de chaves de cache no Redis
        try
        {
            await _redisService.RemoveAsync($"tenant:{tenantId}:profile");
            await _redisService.RemoveAsync($"tenant:{tenantId}:configs");
        }
        catch (Exception redisEx)
        {
            _logger.LogWarning(redisEx, "Erro não-bloqueante ao limpar chaves do Redis no expurgo do Tenant {TenantId}.", tenantId);
        }

        // Registro de Auditoria Final
        var finalLog = new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Action = "DATA_ERASURE_COMPLETED",
            EntityName = "Tenant",
            EntityId = tenantId.ToString(),
            NewValuesJson = "{\"status\": \"ANONYMIZED\", \"reason\": \"LGPD_RIGHT_TO_BE_FORGOTTEN\"}",
            CreatedAt = DateTimeOffset.UtcNow
        };
        await _auditRepository.CreateAsync(finalLog, cancellationToken);

        _logger.LogInformation("Processo de Direito ao Esquecimento concluído para o Tenant {TenantId}.", tenantId);
    }
}
