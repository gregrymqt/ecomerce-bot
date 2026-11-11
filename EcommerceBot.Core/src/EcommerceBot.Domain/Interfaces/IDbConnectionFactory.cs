using System.Data;
using System.Threading;
using System.Threading.Tasks;

namespace EcommerceBot.Domain.Interfaces;

public interface IDbConnectionFactory
{
    Task<IDbConnection> CreateConnectionAsync(CancellationToken cancellationToken = default);
    Task<IDbConnection> CreateConnectionAsync(System.Guid? tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Abre conexão de sistema com privilégio elevado (IsSuperAdmin = 1) exclusivamente para lookups globais
    /// pré-tenant (ex.: resolução de domínio em webhooks externos antes de conhecer o TenantId).
    /// </summary>
    Task<IDbConnection> CreateSystemConnectionAsync(CancellationToken cancellationToken = default);
}
