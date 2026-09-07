using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Exceptions;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories;

public sealed class TenantRepository : ITenantRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public TenantRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<Tenant?> GetByIdAsync(Guid tenantId)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = "SELECT * FROM dbo.Tenants WHERE Id = @Id AND IsActive = 1";
        return await connection.QueryFirstOrDefaultAsync<Tenant>(sql, new { Id = tenantId });
    }

    public async Task<Tenant?> GetBySlugAsync(string slug)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = "SELECT * FROM dbo.Tenants WHERE Slug = @Slug AND IsActive = 1";
        return await connection.QueryFirstOrDefaultAsync<Tenant>(sql, new { Slug = slug });
    }

    public async Task<bool> HasCreditsAsync(Guid tenantId, int requiredCredits = 1)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = "SELECT CreditsBalance FROM dbo.Tenants WHERE Id = @Id AND IsActive = 1";
        var balance = await connection.ExecuteScalarAsync<int?>(sql, new { Id = tenantId });
        return balance.HasValue && balance.Value >= requiredCredits;
    }

    public async Task<int> DeductCreditsAsync(
        Guid tenantId, 
        int amount, 
        string type = "PRODUCT_ENRICHMENT", 
        string description = "Consumo de créditos de IA", 
        string? referenceId = null, 
        Guid? orderId = null)
    {
        if (amount <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(amount), "A quantidade de créditos a deduzir deve ser maior que zero.");
        }

        using var connection = await _connectionFactory.CreateConnectionAsync();

        // 1. Atualização Atômica Anti-Double-Spending no SQL Server
        const string sqlUpdate = """
            UPDATE dbo.Tenants 
            SET CreditsBalance = CreditsBalance - @Amount,
                UpdatedAt = SYSDATETIMEOFFSET()
            OUTPUT inserted.CreditsBalance
            WHERE Id = @TenantId AND IsActive = 1 AND CreditsBalance >= @Amount;
        """;

        var newBalance = await connection.ExecuteScalarAsync<int?>(sqlUpdate, new { TenantId = tenantId, Amount = amount });

        // Se 0 linhas afetadas, o saldo era menor que a quantidade requerida
        if (!newBalance.HasValue)
        {
            const string sqlCheck = "SELECT CreditsBalance FROM dbo.Tenants WHERE Id = @TenantId AND IsActive = 1";
            var current = await connection.ExecuteScalarAsync<int?>(sqlCheck, new { TenantId = tenantId }) ?? 0;
            throw new InsufficientCreditsException(tenantId, amount, current);
        }

        // 2. Registro Auditável no Ledger (dbo.CreditTransactions)
        const string sqlInsertLedger = """
            INSERT INTO dbo.CreditTransactions 
            (Id, TenantId, OrderId, Amount, BalanceAfter, Type, Description, ReferenceId, CreatedAt)
            VALUES 
            (@Id, @TenantId, @OrderId, @Amount, @BalanceAfter, @Type, @Description, @ReferenceId, SYSDATETIMEOFFSET());
        """;

        await connection.ExecuteAsync(sqlInsertLedger, new
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            OrderId = orderId,
            Amount = -amount, // Valor negativo para representar saída no ledger
            BalanceAfter = newBalance.Value,
            Type = type,
            Description = description,
            ReferenceId = referenceId
        });

        return newBalance.Value;
    }

    public async Task<int> AddCreditsAsync(
        Guid tenantId, 
        int amount, 
        string type = "RECHARGE", 
        string description = "Adição de créditos", 
        string? referenceId = null, 
        Guid? orderId = null)
    {
        if (amount <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(amount), "A quantidade de créditos a adicionar deve ser maior que zero.");
        }

        using var connection = await _connectionFactory.CreateConnectionAsync();

        // 1. Adição Atômica no SQL Server
        const string sqlUpdate = """
            UPDATE dbo.Tenants 
            SET CreditsBalance = CreditsBalance + @Amount,
                UpdatedAt = SYSDATETIMEOFFSET()
            OUTPUT inserted.CreditsBalance
            WHERE Id = @TenantId AND IsActive = 1;
        """;

        var newBalance = await connection.ExecuteScalarAsync<int?>(sqlUpdate, new { TenantId = tenantId, Amount = amount });

        if (!newBalance.HasValue)
        {
            throw new InvalidOperationException($"Tenant com Id '{tenantId}' não encontrado ou inativo.");
        }

        // 2. Registro Auditável no Ledger (dbo.CreditTransactions)
        const string sqlInsertLedger = """
            INSERT INTO dbo.CreditTransactions 
            (Id, TenantId, OrderId, Amount, BalanceAfter, Type, Description, ReferenceId, CreatedAt)
            VALUES 
            (@Id, @TenantId, @OrderId, @Amount, @BalanceAfter, @Type, @Description, @ReferenceId, SYSDATETIMEOFFSET());
        """;

        await connection.ExecuteAsync(sqlInsertLedger, new
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            OrderId = orderId,
            Amount = amount, // Valor positivo para representar entrada no ledger
            BalanceAfter = newBalance.Value,
            Type = type,
            Description = description,
            ReferenceId = referenceId
        });

        return newBalance.Value;
    }

    public async Task<int> ReverseCreditsAsync(
        Guid tenantId, 
        int amount, 
        string type = "CHARGEBACK_REVERSAL", 
        string description = "Estorno / Chargeback de créditos", 
        string? referenceId = null, 
        Guid? orderId = null)
    {
        if (amount <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(amount), "A quantidade de créditos a reverter deve ser maior que zero.");
        }

        using var connection = await _connectionFactory.CreateConnectionAsync();

        // 1. Dedução Atômica Incondicional no SQL Server (pode negativar saldo se créditos já foram gastos)
        const string sqlUpdate = """
            UPDATE dbo.Tenants 
            SET CreditsBalance = CreditsBalance - @Amount,
                UpdatedAt = SYSDATETIMEOFFSET()
            OUTPUT inserted.CreditsBalance
            WHERE Id = @TenantId;
        """;

        var newBalance = await connection.ExecuteScalarAsync<int?>(sqlUpdate, new { TenantId = tenantId, Amount = amount });

        if (!newBalance.HasValue)
        {
            throw new InvalidOperationException($"Tenant com Id '{tenantId}' não encontrado.");
        }

        // Se o saldo ficar negativo (créditos foram consumidos antes do estorno/chargeback), suspender preventivamente
        if (newBalance.Value < 0)
        {
            const string sqlSuspend = """
                UPDATE dbo.Tenants
                SET IsActive = 0,
                    UpdatedAt = SYSDATETIMEOFFSET()
                WHERE Id = @TenantId;
            """;
            await connection.ExecuteAsync(sqlSuspend, new { TenantId = tenantId });
        }

        // 2. Registro Auditável no Ledger (dbo.CreditTransactions)
        const string sqlInsertLedger = """
            INSERT INTO dbo.CreditTransactions 
            (Id, TenantId, OrderId, Amount, BalanceAfter, Type, Description, ReferenceId, CreatedAt)
            VALUES 
            (@Id, @TenantId, @OrderId, @Amount, @BalanceAfter, @Type, @Description, @ReferenceId, SYSDATETIMEOFFSET());
        """;

        await connection.ExecuteAsync(sqlInsertLedger, new
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            OrderId = orderId,
            Amount = -amount, // Valor negativo para representar saída no ledger
            BalanceAfter = newBalance.Value,
            Type = type,
            Description = description,
            ReferenceId = referenceId
        });

        return newBalance.Value;
    }

    public async Task<IEnumerable<CreditTransaction>> GetCreditTransactionsAsync(Guid tenantId, int limit = 50, int offset = 0, string? type = null)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        
        string sql = """
            SELECT Id, TenantId, OrderId, Amount, BalanceAfter, Type, Description, ReferenceId, CreatedAt
            FROM dbo.CreditTransactions
            WHERE TenantId = @TenantId
        """;

        if (!string.IsNullOrEmpty(type) && !type.Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            sql += " AND Type = @Type";
        }

        sql += """
            ORDER BY CreatedAt DESC
            OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
        """;

        return await connection.QueryAsync<CreditTransaction>(sql, new
        {
            TenantId = tenantId,
            Type = type,
            Offset = offset,
            Limit = limit
        });
    }

    public async Task<int> CountCreditTransactionsAsync(Guid tenantId, string? type = null)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        
        string sql = "SELECT COUNT(1) FROM dbo.CreditTransactions WHERE TenantId = @TenantId";

        if (!string.IsNullOrEmpty(type) && !type.Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            sql += " AND Type = @Type";
        }

        return await connection.ExecuteScalarAsync<int>(sql, new { TenantId = tenantId, Type = type });
    }

    public async Task RecordTransactionAsync(CreditTransaction transaction)
    {
        if (transaction.Id == Guid.Empty) transaction.Id = Guid.NewGuid();
        if (transaction.CreatedAt == default) transaction.CreatedAt = DateTimeOffset.UtcNow;

        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = """
            INSERT INTO dbo.CreditTransactions 
            (Id, TenantId, OrderId, Amount, BalanceAfter, Type, Description, ReferenceId, CreatedAt)
            VALUES 
            (@Id, @TenantId, @OrderId, @Amount, @BalanceAfter, @Type, @Description, @ReferenceId, @CreatedAt);
        """;

        await connection.ExecuteAsync(sql, transaction);
    }

    public async Task AddManagedBalanceAsync(Guid tenantId, decimal amount)
    {
        // Converte saldo monetário em créditos unificados (R$ 1,00 = 10 créditos) e registra no Ledger
        var credits = (int)Math.Ceiling(amount * 10);
        await AddCreditsAsync(
            tenantId: tenantId, 
            amount: credits, 
            type: "RECHARGE", 
            description: $"Recarga de saldo convertida (R$ {amount:F2})"
        );
    }

    public async Task<Tenant> CreateAsync(Tenant tenant)
    {
        if (tenant.Id == Guid.Empty) tenant.Id = Guid.NewGuid();
        if (tenant.CreatedAt == default) tenant.CreatedAt = DateTimeOffset.UtcNow;
        if (tenant.UpdatedAt == default) tenant.UpdatedAt = DateTimeOffset.UtcNow;
        if (string.IsNullOrWhiteSpace(tenant.Slug)) tenant.Slug = tenant.Name.ToLower().Replace(" ", "-") + "-" + Guid.NewGuid().ToString("N")[..6];

        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = """
            INSERT INTO dbo.Tenants (
                Id, Name, Slug, PlanTier, CreditsBalance, ManagedCreditBalance, IsActive,
                FirstUtmSource, FirstUtmMedium, FirstUtmCampaign, FirstAdId, FirstTouchAt,
                CreatedAt, UpdatedAt
            ) VALUES (
                @Id, @Name, @Slug, @PlanTier, @CreditsBalance, @ManagedCreditBalance, @IsActive,
                @FirstUtmSource, @FirstUtmMedium, @FirstUtmCampaign, @FirstAdId, @FirstTouchAt,
                @CreatedAt, @UpdatedAt
            );
        """;
        await connection.ExecuteAsync(sql, tenant);
        return tenant;
    }
}
