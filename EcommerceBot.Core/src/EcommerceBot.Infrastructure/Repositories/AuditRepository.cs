using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories;

/// <summary>
/// Repositório de alta performance para auditoria Append-Only e rastreabilidade de conformidade.
/// Atende rigorosamente à Regra 1 do AGENTS.md (WHERE TenantId = @TenantId) e RLS via SESSION_CONTEXT.
/// </summary>
public sealed class AuditRepository : IAuditRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public AuditRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory ?? throw new ArgumentNullException(nameof(connectionFactory));
    }

    public async Task CreateAsync(AuditLog auditLog, CancellationToken cancellationToken = default)
    {
        if (auditLog == null) throw new ArgumentNullException(nameof(auditLog));
        if (auditLog.TenantId == Guid.Empty) throw new ArgumentException("TenantId é obrigatório para registrar log de auditoria.", nameof(auditLog));

        using var connection = await _connectionFactory.CreateConnectionAsync(auditLog.TenantId, cancellationToken);

        const string sql = @"
            INSERT INTO dbo.AuditLogs (
                Id, TenantId, UserId, Action, EntityName, EntityId, 
                OldValuesJson, NewValuesJson, IpAddress, UserAgent, CreatedAt
            )
            VALUES (
                @Id, @TenantId, @UserId, @Action, @EntityName, @EntityId, 
                @OldValuesJson, @NewValuesJson, @IpAddress, @UserAgent, SYSDATETIMEOFFSET()
            );";

        if (auditLog.Id == Guid.Empty)
        {
            auditLog.Id = Guid.NewGuid();
        }

        var cmd = new CommandDefinition(sql, auditLog, cancellationToken: cancellationToken);
        await connection.ExecuteAsync(cmd);
    }

    public async Task<IEnumerable<AuditLog>> GetByTenantAsync(Guid tenantId, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("TenantId inválido.", nameof(tenantId));

        page = page < 1 ? 1 : page;
        pageSize = pageSize > 100 ? 100 : (pageSize < 1 ? 50 : pageSize);
        var offset = (page - 1) * pageSize;

        using var connection = await _connectionFactory.CreateConnectionAsync(tenantId, cancellationToken);

        const string sql = @"
            SELECT 
                Id, TenantId, UserId, Action, EntityName, EntityId, 
                OldValuesJson, NewValuesJson, IpAddress, UserAgent, CreatedAt
            FROM dbo.AuditLogs
            WHERE TenantId = @TenantId
            ORDER BY CreatedAt DESC
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;";

        var cmd = new CommandDefinition(sql, new { TenantId = tenantId, Offset = offset, PageSize = pageSize }, cancellationToken: cancellationToken);
        return await connection.QueryAsync<AuditLog>(cmd);
    }
}
