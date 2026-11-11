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
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace EcommerceBot.Infrastructure.Data;

/// <summary>
/// Fábrica de conexões ADO.NET / Microsoft.Data.SqlClient para consultas de alta performance via Dapper.
/// Aplica injeção de contexto de sessão (sp_set_session_context) para Row-Level Security (RLS) nativo do SQL Server.
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

        // Sanitização defensiva para conexões locais via Docker Desktop (WSL2):
        // 'localhost' resolve para IPv6 (::1) no Windows, provocando reset de conexão (error: 0) no handshake TDS.
        if (_connectionString.Contains("localhost", StringComparison.OrdinalIgnoreCase))
        {
            _connectionString = _connectionString.Replace("localhost", "127.0.0.1", StringComparison.OrdinalIgnoreCase);
        }

        if (_connectionString.Contains("Encrypt=False", StringComparison.OrdinalIgnoreCase))
        {
            _connectionString = _connectionString.Replace("Encrypt=False", "Encrypt=True", StringComparison.OrdinalIgnoreCase);
        }

        _httpContextAccessor = httpContextAccessor;
    }

    public Task<IDbConnection> CreateConnectionAsync(CancellationToken cancellationToken = default)
    {
        return CreateConnectionAsync(null, cancellationToken);
    }

    public async Task<IDbConnection> CreateConnectionAsync(Guid? tenantId, CancellationToken cancellationToken = default)
    {
        // Resolução de Tenant e Privilégios para RLS
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

        // 3. Fallback para escopo ambiente AsyncLocal (MassTransit consumers, callbacks e webhooks pós-lookup)
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
        var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        // Sempre limpa o SESSION_CONTEXT ao reutilizar conexão do pool para evitar vazamento entre tenants
        const string resetSql = """
            EXEC sp_set_session_context @key=N'IsSuperAdmin', @value=NULL;
            EXEC sp_set_session_context @key=N'TenantId', @value=NULL;
        """;
        await connection.ExecuteAsync(new CommandDefinition(resetSql, cancellationToken: cancellationToken));

        if (isSuperAdmin)
        {
            var adminCmd = new CommandDefinition(
                "EXEC sp_set_session_context @key=N'IsSuperAdmin', @value=1;",
                cancellationToken: cancellationToken);
            await connection.ExecuteAsync(adminCmd);
        }

        if (effectiveTenantId.HasValue && effectiveTenantId.Value != Guid.Empty)
        {
            var tenantCmd = new CommandDefinition(
                "EXEC sp_set_session_context @key=N'TenantId', @value=@TenantId;",
                new { TenantId = effectiveTenantId.Value },
                cancellationToken: cancellationToken);
            await connection.ExecuteAsync(tenantCmd);
        }

        return connection;
    }
}
