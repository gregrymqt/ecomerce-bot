using System;
using System.Data;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Application.Interfaces;
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
        var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

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

        // Se for SuperAdmin, ativa a flag de bypass administrativo global na sessão
        if (isSuperAdmin)
        {
            var adminCmd = new CommandDefinition(
                "EXEC sp_set_session_context @key=N'IsSuperAdmin', @value=1;",
                cancellationToken: cancellationToken);
            await connection.ExecuteAsync(adminCmd);
        }

        // Injeta o TenantId na sessão SQL Server para ativação do predicado RLS
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
