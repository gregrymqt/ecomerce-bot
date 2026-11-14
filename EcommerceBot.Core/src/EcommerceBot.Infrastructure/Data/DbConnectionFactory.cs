using System;
using System.Data;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Application.Security;
using EcommerceBot.Domain.Interfaces;
using EcommerceBot.Infrastructure.Options;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Npgsql;

namespace EcommerceBot.Infrastructure.Data;

/// <summary>
/// Fábrica de conexões ADO.NET / Npgsql para consultas de alta performance via Dapper.
/// Aplica injeção de contexto de sessão (SET app.tenant_id e SET app.is_super_admin)
/// para Row-Level Security (RLS) nativo do PostgreSQL 16.
/// </summary>
public sealed class DbConnectionFactory : IDbConnectionFactory
{
    private readonly string _connectionString;
    private readonly IHttpContextAccessor? _httpContextAccessor;

    public DbConnectionFactory(
        IOptions<DatabaseOptions> databaseOptions,
        IHttpContextAccessor? httpContextAccessor = null)
    {
        _connectionString = databaseOptions?.Value?.DefaultConnection
            ?? throw new ArgumentNullException(nameof(databaseOptions), "Configurações de banco não fornecidas.");

        if (string.IsNullOrWhiteSpace(_connectionString))
        {
            throw new ArgumentNullException(nameof(databaseOptions), "Connection string 'DefaultConnection' not found in configuration.");
        }

        _httpContextAccessor = httpContextAccessor;
    }

    public Task<IDbConnection> CreateConnectionAsync(CancellationToken cancellationToken = default)
    {
        return CreateConnectionAsync(null, cancellationToken);
    }

    public async Task<IDbConnection> CreateConnectionAsync(Guid? tenantId, CancellationToken cancellationToken = default)
    {
        Guid? effectiveTenantId = tenantId;
        bool isSuperAdmin = false;

        var httpContext = _httpContextAccessor?.HttpContext;
        if (httpContext != null)
        {
            // 1. Verifica se o usuário autenticado possui role de Super Administrador
            if (httpContext.User?.IsInRole("ADMIN") == true)
            {
                isSuperAdmin = true;
            }

            // 2. Se o tenantId não foi passado explicitamente, tenta resolver do contexto da requisição
            if (!effectiveTenantId.HasValue || effectiveTenantId.Value == Guid.Empty)
            {
                var tenantContext = httpContext.RequestServices?.GetService<ITenantContext>();
                if (tenantContext != null && tenantContext.HasTenant)
                {
                    effectiveTenantId = tenantContext.TenantId;
                }
            }
        }

        // 3. Fallback para escopo ambiente AsyncLocal
        if (!effectiveTenantId.HasValue || effectiveTenantId.Value == Guid.Empty)
        {
            var ambientTenantId = TenantSessionScope.CurrentTenantId;
            if (ambientTenantId.HasValue && ambientTenantId.Value != Guid.Empty)
            {
                effectiveTenantId = ambientTenantId.Value;
            }
        }

        return await OpenConfiguredConnectionAsync(effectiveTenantId, isSuperAdmin, cancellationToken);
    }

    public Task<IDbConnection> CreateSystemConnectionAsync(CancellationToken cancellationToken = default)
    {
        return OpenConfiguredConnectionAsync(effectiveTenantId: null, isSuperAdmin: true, cancellationToken);
    }

    private async Task<IDbConnection> OpenConfiguredConnectionAsync(
        Guid? effectiveTenantId,
        bool isSuperAdmin,
        CancellationToken cancellationToken)
    {
        var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        // Sempre reseta as variáveis de sessão RLS da conexão para evitar vazamento entre tenants do pool
        const string resetSql = "RESET app.is_super_admin; RESET app.tenant_id;";
        await connection.ExecuteAsync(new CommandDefinition(resetSql, cancellationToken: cancellationToken));

        if (isSuperAdmin)
        {
            var adminCmd = new CommandDefinition(
                "SET app.is_super_admin = '1';",
                cancellationToken: cancellationToken);
            await connection.ExecuteAsync(adminCmd);
        }

        if (effectiveTenantId.HasValue && effectiveTenantId.Value != Guid.Empty)
        {
            var tenantCmd = new CommandDefinition(
                $"SET app.tenant_id = '{effectiveTenantId.Value}';",
                cancellationToken: cancellationToken);
            await connection.ExecuteAsync(tenantCmd);
        }

        return connection;
    }
}
