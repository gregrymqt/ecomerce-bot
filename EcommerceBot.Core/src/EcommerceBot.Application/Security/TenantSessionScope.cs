using System;
using System.Threading;

namespace EcommerceBot.Application.Security;

/// <summary>
/// Escopo assíncrono isolado (AsyncLocal) para propagação de TenantId em consumidores assíncronos
/// e fluxos pré-contexto HTTP (webhooks / callbacks OAuth) sem risco de vazamento entre threads do pool.
/// </summary>
public static class TenantSessionScope
{
    private static readonly AsyncLocal<Guid?> AmbientTenantId = new();

    public static Guid? CurrentTenantId => AmbientTenantId.Value;

    public static IDisposable BeginScope(Guid tenantId)
    {
        var previous = AmbientTenantId.Value;
        AmbientTenantId.Value = tenantId == Guid.Empty ? null : tenantId;
        return new ScopeGuard(previous);
    }

    private sealed class ScopeGuard(Guid? previous) : IDisposable
    {
        private bool _disposed;

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            AmbientTenantId.Value = previous;
        }
    }
}
