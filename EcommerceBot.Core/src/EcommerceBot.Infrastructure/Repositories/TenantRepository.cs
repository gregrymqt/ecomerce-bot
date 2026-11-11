using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Exceptions;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories;

public sealed class TenantRepository : ITenantRepository
{
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly IRedisService _redisService;

    public TenantRepository(IDbConnectionFactory connectionFactory, IRedisService redisService)
    {
        _connectionFactory = connectionFactory;
        _redisService = redisService;
    }

    private static string GetTenantCacheKey(Guid tenantId) => $"tenant:{tenantId}";
    private static string GetTenantSlugCacheKey(string slug) => $"tenant:slug:{slug.ToLowerInvariant()}";

    public async Task<Tenant?> GetByIdAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var cacheKey = GetTenantCacheKey(tenantId);

        return await _redisService.GetOrCreateAsync(
            cacheKey,
            async () =>
            {
                using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
                const string sql = "SELECT * FROM dbo.Tenants WHERE Id = @Id AND IsActive = 1";
                var cmd = new CommandDefinition(sql, new { Id = tenantId }, cancellationToken: cancellationToken);
                return await connection.QueryFirstOrDefaultAsync<Tenant>(cmd);
            },
            TimeSpan.FromMinutes(30),
            cancellationToken);
    }

    public async Task<Tenant?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default)
    {
        var cacheKey = GetTenantSlugCacheKey(slug);

        return await _redisService.GetOrCreateAsync(
            cacheKey,
            async () =>
            {
                using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
                const string sql = "SELECT * FROM dbo.Tenants WHERE Slug = @Slug AND IsActive = 1";
                var cmd = new CommandDefinition(sql, new { Slug = slug }, cancellationToken: cancellationToken);
                return await connection.QueryFirstOrDefaultAsync<Tenant>(cmd);
            },
            TimeSpan.FromMinutes(30),
            cancellationToken);
    }

    public async Task<bool> HasCreditsAsync(Guid tenantId, int requiredCredits = 1, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(tenantId, cancellationToken);
        const string sql = "SELECT CreditsBalance FROM dbo.Tenants WHERE Id = @Id AND IsActive = 1";
        var cmd = new CommandDefinition(sql, new { Id = tenantId }, cancellationToken: cancellationToken);
        var balance = await connection.ExecuteScalarAsync<int?>(cmd);
        return balance.HasValue && balance.Value >= requiredCredits;
    }

    public async Task<int> DeductCreditsAsync(
        Guid tenantId, 
        int amount, 
        string type = "PRODUCT_ENRICHMENT", 
        string description = "Consumo de créditos de IA", 
        string? referenceId = null, 
        Guid? orderId = null,
        CancellationToken cancellationToken = default)
    {
        if (amount <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(amount), "A quantidade de créditos a deduzir deve ser maior que zero.");
        }

        using var connection = await _connectionFactory.CreateConnectionAsync(tenantId, cancellationToken);

        // 1. Atualização Atômica Anti-Double-Spending no SQL Server
        const string sqlUpdate = """
            UPDATE dbo.Tenants 
            SET CreditsBalance = CreditsBalance - @Amount,
                UpdatedAt = SYSDATETIMEOFFSET()
            OUTPUT inserted.CreditsBalance
            WHERE Id = @TenantId AND IsActive = 1 AND CreditsBalance >= @Amount;
        """;

        var updateCmd = new CommandDefinition(sqlUpdate, new { TenantId = tenantId, Amount = amount }, cancellationToken: cancellationToken);
        var newBalance = await connection.ExecuteScalarAsync<int?>(updateCmd);

        // Se 0 linhas afetadas, o saldo era menor que a quantidade requerida
        if (!newBalance.HasValue)
        {
            const string sqlCheck = "SELECT CreditsBalance FROM dbo.Tenants WHERE Id = @TenantId AND IsActive = 1";
            var checkCmd = new CommandDefinition(sqlCheck, new { TenantId = tenantId }, cancellationToken: cancellationToken);
            var current = await connection.ExecuteScalarAsync<int?>(checkCmd) ?? 0;
            throw new InsufficientCreditsException(tenantId, amount, current);
        }

        // 2. Registro Auditável no Ledger (dbo.CreditTransactions)
        const string sqlInsertLedger = """
            INSERT INTO dbo.CreditTransactions 
            (Id, TenantId, OrderId, Amount, BalanceAfter, Type, Description, ReferenceId, CreatedAt)
            VALUES 
            (@Id, @TenantId, @OrderId, @Amount, @BalanceAfter, @Type, @Description, @ReferenceId, SYSDATETIMEOFFSET());
        """;

        var ledgerCmd = new CommandDefinition(sqlInsertLedger, new
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            OrderId = orderId,
            Amount = -amount, // Valor negativo para representar saída no ledger
            BalanceAfter = newBalance.Value,
            Type = type,
            Description = description,
            ReferenceId = referenceId
        }, cancellationToken: cancellationToken);

        await connection.ExecuteAsync(ledgerCmd);

        // Invalida cache do tenant devido à alteração de saldo
        await _redisService.RemoveAsync(GetTenantCacheKey(tenantId), cancellationToken);

        return newBalance.Value;
    }

    public async Task<int> AddCreditsAsync(
        Guid tenantId, 
        int amount, 
        string type = "RECHARGE", 
        string description = "Adição de créditos", 
        string? referenceId = null, 
        Guid? orderId = null,
        CancellationToken cancellationToken = default)
    {
        if (amount <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(amount), "A quantidade de créditos a adicionar deve ser maior que zero.");
        }

        using var connection = await _connectionFactory.CreateConnectionAsync(tenantId, cancellationToken);

        // 1. Adição Atômica no SQL Server
        const string sqlUpdate = """
            UPDATE dbo.Tenants 
            SET CreditsBalance = CreditsBalance + @Amount,
                UpdatedAt = SYSDATETIMEOFFSET()
            OUTPUT inserted.CreditsBalance
            WHERE Id = @TenantId AND IsActive = 1;
        """;

        var updateCmd = new CommandDefinition(sqlUpdate, new { TenantId = tenantId, Amount = amount }, cancellationToken: cancellationToken);
        var newBalance = await connection.ExecuteScalarAsync<int?>(updateCmd);

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

        var ledgerCmd = new CommandDefinition(sqlInsertLedger, new
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            OrderId = orderId,
            Amount = amount, // Valor positivo para representar entrada no ledger
            BalanceAfter = newBalance.Value,
            Type = type,
            Description = description,
            ReferenceId = referenceId
        }, cancellationToken: cancellationToken);

        await connection.ExecuteAsync(ledgerCmd);

        // Invalida cache do tenant
        await _redisService.RemoveAsync(GetTenantCacheKey(tenantId), cancellationToken);

        return newBalance.Value;
    }

    public async Task<int> ReverseCreditsAsync(
        Guid tenantId, 
        int amount, 
        string type = "CHARGEBACK_REVERSAL", 
        string description = "Estorno / Chargeback de créditos", 
        string? referenceId = null, 
        Guid? orderId = null,
        CancellationToken cancellationToken = default)
    {
        if (amount <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(amount), "A quantidade de créditos a reverter deve ser maior que zero.");
        }

        using var connection = await _connectionFactory.CreateConnectionAsync(tenantId, cancellationToken);

        // 1. Dedução Atômica Incondicional no SQL Server
        const string sqlUpdate = """
            UPDATE dbo.Tenants 
            SET CreditsBalance = CreditsBalance - @Amount,
                UpdatedAt = SYSDATETIMEOFFSET()
            OUTPUT inserted.CreditsBalance
            WHERE Id = @TenantId;
        """;

        var updateCmd = new CommandDefinition(sqlUpdate, new { TenantId = tenantId, Amount = amount }, cancellationToken: cancellationToken);
        var newBalance = await connection.ExecuteScalarAsync<int?>(updateCmd);

        if (!newBalance.HasValue)
        {
            throw new InvalidOperationException($"Tenant com Id '{tenantId}' não encontrado.");
        }

        // Se o saldo ficar negativo, suspender preventivamente
        if (newBalance.Value < 0)
        {
            const string sqlSuspend = """
                UPDATE dbo.Tenants
                SET IsActive = 0,
                    UpdatedAt = SYSDATETIMEOFFSET()
                WHERE Id = @TenantId;
            """;
            var suspendCmd = new CommandDefinition(sqlSuspend, new { TenantId = tenantId }, cancellationToken: cancellationToken);
            await connection.ExecuteAsync(suspendCmd);
        }

        // 2. Registro Auditável no Ledger (dbo.CreditTransactions)
        const string sqlInsertLedger = """
            INSERT INTO dbo.CreditTransactions 
            (Id, TenantId, OrderId, Amount, BalanceAfter, Type, Description, ReferenceId, CreatedAt)
            VALUES 
            (@Id, @TenantId, @OrderId, @Amount, @BalanceAfter, @Type, @Description, @ReferenceId, SYSDATETIMEOFFSET());
        """;

        var ledgerCmd = new CommandDefinition(sqlInsertLedger, new
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            OrderId = orderId,
            Amount = -amount,
            BalanceAfter = newBalance.Value,
            Type = type,
            Description = description,
            ReferenceId = referenceId
        }, cancellationToken: cancellationToken);

        await connection.ExecuteAsync(ledgerCmd);

        // Invalida cache do tenant
        await _redisService.RemoveAsync(GetTenantCacheKey(tenantId), cancellationToken);

        return newBalance.Value;
    }

    public async Task<IEnumerable<CreditTransaction>> GetCreditTransactionsAsync(
        Guid tenantId, 
        int limit = 50, 
        int offset = 0, 
        string? type = null,
        CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(tenantId, cancellationToken);
        
        string sql = """
            SELECT Id, TenantId, OrderId, Amount, BalanceAfter, Type, Description, ReferenceId, CreatedAt
            FROM dbo.CreditTransactions
            WHERE TenantId = @TenantId
        """;

        if (!string.IsNullOrEmpty(type) && !type.Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            if (type.Equals("RECHARGE", StringComparison.OrdinalIgnoreCase))
            {
                sql += " AND (Amount > 0 OR Type IN ('RECHARGE', 'WELCOME_BONUS', 'REFUND'))";
            }
            else if (type.Equals("USAGE", StringComparison.OrdinalIgnoreCase))
            {
                sql += " AND (Amount < 0 OR Type IN ('PRODUCT_ENRICHMENT', 'ML_ANALYSIS', 'CHARGEBACK_REVERSAL'))";
            }
            else
            {
                sql += " AND Type = @Type";
            }
        }

        sql += """
            ORDER BY CreatedAt DESC
            OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
        """;

        limit = Math.Clamp(limit, 1, 200);
        offset = Math.Max(0, offset);

        var cmd = new CommandDefinition(sql, new
        {
            TenantId = tenantId,
            Type = type,
            Offset = offset,
            Limit = limit
        }, cancellationToken: cancellationToken);

        return await connection.QueryAsync<CreditTransaction>(cmd);
    }

    public async Task<int> CountCreditTransactionsAsync(Guid tenantId, string? type = null, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(tenantId, cancellationToken);
        
        string sql = "SELECT COUNT(1) FROM dbo.CreditTransactions WHERE TenantId = @TenantId";

        if (!string.IsNullOrEmpty(type) && !type.Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            if (type.Equals("RECHARGE", StringComparison.OrdinalIgnoreCase))
            {
                sql += " AND (Amount > 0 OR Type IN ('RECHARGE', 'WELCOME_BONUS', 'REFUND'))";
            }
            else if (type.Equals("USAGE", StringComparison.OrdinalIgnoreCase))
            {
                sql += " AND (Amount < 0 OR Type IN ('PRODUCT_ENRICHMENT', 'ML_ANALYSIS', 'CHARGEBACK_REVERSAL'))";
            }
            else
            {
                sql += " AND Type = @Type";
            }
        }

        var cmd = new CommandDefinition(sql, new { TenantId = tenantId, Type = type }, cancellationToken: cancellationToken);
        return await connection.ExecuteScalarAsync<int>(cmd);
    }

    public async Task RecordTransactionAsync(CreditTransaction transaction, CancellationToken cancellationToken = default)
    {
        if (transaction.Id == Guid.Empty) transaction.Id = Guid.NewGuid();
        if (transaction.CreatedAt == default) transaction.CreatedAt = DateTimeOffset.UtcNow;

        using var connection = await _connectionFactory.CreateConnectionAsync(transaction.TenantId, cancellationToken);
        const string sql = """
            INSERT INTO dbo.CreditTransactions 
            (Id, TenantId, OrderId, Amount, BalanceAfter, Type, Description, ReferenceId, CreatedAt)
            VALUES 
            (@Id, @TenantId, @OrderId, @Amount, @BalanceAfter, @Type, @Description, @ReferenceId, @CreatedAt);
        """;

        var cmd = new CommandDefinition(sql, transaction, cancellationToken: cancellationToken);
        await connection.ExecuteAsync(cmd);
    }

    public async Task AddManagedBalanceAsync(Guid tenantId, decimal amount, CancellationToken cancellationToken = default)
    {
        // Converte saldo monetário em créditos unificados (R$ 1,00 = 10 créditos) e registra no Ledger
        var credits = (int)Math.Ceiling(amount * 10);
        await AddCreditsAsync(
            tenantId: tenantId, 
            amount: credits, 
            type: "RECHARGE", 
            description: $"Recarga de saldo convertida (R$ {amount:F2})",
            cancellationToken: cancellationToken
        );
    }

    public async Task<Tenant> CreateAsync(Tenant tenant, CancellationToken cancellationToken = default)
    {
        if (tenant.Id == Guid.Empty) tenant.Id = Guid.NewGuid();
        if (tenant.CreatedAt == default) tenant.CreatedAt = DateTimeOffset.UtcNow;
        if (tenant.UpdatedAt == default) tenant.UpdatedAt = DateTimeOffset.UtcNow;
        if (string.IsNullOrWhiteSpace(tenant.Slug)) tenant.Slug = tenant.Name.ToLower().Replace(" ", "-") + "-" + Guid.NewGuid().ToString("N")[..6];

        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
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
        var cmd = new CommandDefinition(sql, tenant, cancellationToken: cancellationToken);
        await connection.ExecuteAsync(cmd);
        return tenant;
    }

    public async Task<User> ProvisionTenantWithOwnerAsync(
        Tenant tenant,
        CreditTransaction welcomeBonus,
        User owner,
        CancellationToken cancellationToken = default)
    {
        if (tenant.Id == Guid.Empty) tenant.Id = Guid.NewGuid();
        if (tenant.CreatedAt == default) tenant.CreatedAt = DateTimeOffset.UtcNow;
        if (tenant.UpdatedAt == default) tenant.UpdatedAt = DateTimeOffset.UtcNow;
        if (string.IsNullOrWhiteSpace(tenant.Slug)) tenant.Slug = tenant.Name.ToLower().Replace(" ", "-") + "-" + Guid.NewGuid().ToString("N")[..6];

        if (welcomeBonus.Id == Guid.Empty) welcomeBonus.Id = Guid.NewGuid();
        welcomeBonus.TenantId = tenant.Id;
        if (welcomeBonus.CreatedAt == default) welcomeBonus.CreatedAt = DateTimeOffset.UtcNow;

        if (owner.Id == Guid.Empty) owner.Id = Guid.NewGuid();
        owner.TenantId = tenant.Id;

        using var connection = await _connectionFactory.CreateConnectionAsync(tenant.Id, cancellationToken);
        using var transaction = connection is DbConnection dbConn
            ? await dbConn.BeginTransactionAsync(cancellationToken)
            : connection.BeginTransaction();

        const string sqlTenant = """
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

        const string sqlLedger = """
            INSERT INTO dbo.CreditTransactions
            (Id, TenantId, OrderId, Amount, BalanceAfter, Type, Description, ReferenceId, CreatedAt)
            VALUES
            (@Id, @TenantId, @OrderId, @Amount, @BalanceAfter, @Type, @Description, @ReferenceId, @CreatedAt);
        """;

        const string sqlUser = """
            INSERT INTO dbo.Users (Id, TenantId, RoleId, Email, PasswordHash, FullName, Role, IsActive, CreatedAt, UpdatedAt)
            OUTPUT INSERTED.*
            VALUES (
                @Id,
                @TenantId,
                COALESCE(@RoleId, (SELECT TOP 1 Id FROM dbo.Roles WHERE Name = @Role), '44444444-4444-4444-4444-444444444444'),
                @Email,
                @PasswordHash,
                @FullName,
                @Role,
                @IsActive,
                SYSDATETIMEOFFSET(),
                SYSDATETIMEOFFSET()
            );
        """;

        await connection.ExecuteAsync(new CommandDefinition(sqlTenant, tenant, transaction, cancellationToken: cancellationToken));
        await connection.ExecuteAsync(new CommandDefinition(sqlLedger, welcomeBonus, transaction, cancellationToken: cancellationToken));
        var createdUser = await connection.QuerySingleAsync<User>(new CommandDefinition(sqlUser, owner, transaction, cancellationToken: cancellationToken));

        if (transaction is DbTransaction dbTx)
            await dbTx.CommitAsync(cancellationToken);
        else
            transaction.Commit();

        return createdUser;
    }

    public async Task<(bool Applied, int NewBalance)> TryCreditOrderOnceAsync(
        Guid tenantId,
        Guid orderId,
        int amount,
        string type,
        string description,
        string? referenceId,
        string? mpPaymentId,
        decimal paidAmount,
        CancellationToken cancellationToken = default)
    {
        if (amount <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(amount), "A quantidade de créditos a adicionar deve ser maior que zero.");
        }

        using var connection = await _connectionFactory.CreateConnectionAsync(tenantId, cancellationToken);
        using var transaction = connection is DbConnection dbConn
            ? await dbConn.BeginTransactionAsync(cancellationToken)
            : connection.BeginTransaction();

        const string sqlOrderCheck = """
            SELECT Status, ExternalReference
            FROM dbo.Orders WITH (UPDLOCK, HOLDLOCK)
            WHERE Id = @OrderId AND TenantId = @TenantId;
        """;
        var orderMeta = await connection.QueryFirstOrDefaultAsync<(string? Status, string? ExternalReference)>(
            new CommandDefinition(sqlOrderCheck, new { OrderId = orderId, TenantId = tenantId }, transaction, cancellationToken: cancellationToken));

        var currentBalance = await connection.ExecuteScalarAsync<int>(
            new CommandDefinition("SELECT CreditsBalance FROM dbo.Tenants WITH (UPDLOCK, ROWLOCK) WHERE Id = @TenantId;",
                new { TenantId = tenantId }, transaction, cancellationToken: cancellationToken));

        if (string.IsNullOrEmpty(orderMeta.Status) ||
            string.Equals(orderMeta.Status, "refunded", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(orderMeta.Status, "charged_back", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(orderMeta.Status, "cancelled", StringComparison.OrdinalIgnoreCase))
        {
            if (transaction is DbTransaction dbTx) await dbTx.RollbackAsync(cancellationToken);
            else transaction.Rollback();
            return (false, currentBalance);
        }

        const string sqlLedgerExists = """
            SELECT COUNT(1)
            FROM dbo.CreditTransactions WITH (UPDLOCK, HOLDLOCK)
            WHERE TenantId = @TenantId AND OrderId = @OrderId AND Type = @Type;
        """;
        var existingCount = await connection.ExecuteScalarAsync<int>(
            new CommandDefinition(sqlLedgerExists, new { TenantId = tenantId, OrderId = orderId, Type = type }, transaction, cancellationToken: cancellationToken));

        if (existingCount > 0)
        {
            if (transaction is DbTransaction dbTx) await dbTx.RollbackAsync(cancellationToken);
            else transaction.Rollback();
            return (false, currentBalance);
        }

        const string sqlUpdateOrder = """
            UPDATE dbo.Orders
            SET Status = 'approved',
                PaidAt = COALESCE(PaidAt, SYSDATETIMEOFFSET()),
                TotalPaidAmount = CASE WHEN @PaidAmount > 0 THEN @PaidAmount ELSE COALESCE(TotalPaidAmount, TotalAmount) END,
                MpPaymentId = COALESCE(@MpPaymentId, MpPaymentId),
                UpdatedAt = SYSDATETIMEOFFSET()
            WHERE Id = @OrderId AND TenantId = @TenantId;
        """;
        await connection.ExecuteAsync(new CommandDefinition(
            sqlUpdateOrder,
            new { OrderId = orderId, TenantId = tenantId, PaidAmount = paidAmount, MpPaymentId = mpPaymentId },
            transaction,
            cancellationToken: cancellationToken));

        const string sqlUpdateTenant = """
            UPDATE dbo.Tenants
            SET CreditsBalance = CreditsBalance + @Amount,
                UpdatedAt = SYSDATETIMEOFFSET()
            OUTPUT inserted.CreditsBalance
            WHERE Id = @TenantId AND IsActive = 1;
        """;
        var newBalance = await connection.ExecuteScalarAsync<int?>(new CommandDefinition(
            sqlUpdateTenant,
            new { TenantId = tenantId, Amount = amount },
            transaction,
            cancellationToken: cancellationToken));

        if (!newBalance.HasValue)
        {
            throw new InvalidOperationException($"Tenant com Id '{tenantId}' não encontrado ou inativo.");
        }

        const string sqlInsertLedger = """
            INSERT INTO dbo.CreditTransactions
            (Id, TenantId, OrderId, Amount, BalanceAfter, Type, Description, ReferenceId, CreatedAt)
            VALUES
            (@Id, @TenantId, @OrderId, @Amount, @BalanceAfter, @Type, @Description, @ReferenceId, SYSDATETIMEOFFSET());
        """;
        await connection.ExecuteAsync(new CommandDefinition(sqlInsertLedger, new
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            OrderId = orderId,
            Amount = amount,
            BalanceAfter = newBalance.Value,
            Type = type,
            Description = description,
            ReferenceId = referenceId
        }, transaction, cancellationToken: cancellationToken));

        if (transaction is DbTransaction commitTx) await commitTx.CommitAsync(cancellationToken);
        else transaction.Commit();

        await _redisService.RemoveAsync(GetTenantCacheKey(tenantId), cancellationToken);
        await _redisService.RemoveAsync($"order:tenant:{tenantId}:id:{orderId}", cancellationToken);
        if (!string.IsNullOrWhiteSpace(orderMeta.ExternalReference))
        {
            await _redisService.RemoveAsync($"order:tenant:{tenantId}:ref:{orderMeta.ExternalReference}", cancellationToken);
        }

        return (true, newBalance.Value);
    }

    public async Task<(bool Applied, int NewBalance)> TryReverseOrderCreditsOnceAsync(
        Guid tenantId,
        Guid orderId,
        int amount,
        string type,
        string description,
        string? referenceId,
        string newOrderStatus,
        CancellationToken cancellationToken = default)
    {
        if (amount <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(amount), "A quantidade de créditos a reverter deve ser maior que zero.");
        }

        using var connection = await _connectionFactory.CreateConnectionAsync(tenantId, cancellationToken);
        using var transaction = connection is DbConnection dbConn
            ? await dbConn.BeginTransactionAsync(cancellationToken)
            : connection.BeginTransaction();

        const string sqlOrderCheck = """
            SELECT Status, PaidAt, ExternalReference
            FROM dbo.Orders WITH (UPDLOCK, HOLDLOCK)
            WHERE Id = @OrderId AND TenantId = @TenantId;
        """;
        var orderMeta = await connection.QueryFirstOrDefaultAsync<(string? Status, DateTimeOffset? PaidAt, string? ExternalReference)>(
            new CommandDefinition(sqlOrderCheck, new { OrderId = orderId, TenantId = tenantId }, transaction, cancellationToken: cancellationToken));

        var currentBalance = await connection.ExecuteScalarAsync<int>(
            new CommandDefinition("SELECT CreditsBalance FROM dbo.Tenants WITH (UPDLOCK, ROWLOCK) WHERE Id = @TenantId;",
                new { TenantId = tenantId }, transaction, cancellationToken: cancellationToken));

        if (string.IsNullOrEmpty(orderMeta.Status))
        {
            if (transaction is DbTransaction dbTx) await dbTx.RollbackAsync(cancellationToken);
            else transaction.Rollback();
            return (false, currentBalance);
        }

        const string sqlUpdateOrder = """
            UPDATE dbo.Orders
            SET Status = @NewStatus,
                UpdatedAt = SYSDATETIMEOFFSET()
            WHERE Id = @OrderId AND TenantId = @TenantId;
        """;
        await connection.ExecuteAsync(new CommandDefinition(
            sqlUpdateOrder,
            new { OrderId = orderId, TenantId = tenantId, NewStatus = newOrderStatus },
            transaction,
            cancellationToken: cancellationToken));

        var wasPaid = orderMeta.PaidAt.HasValue || string.Equals(orderMeta.Status, "approved", StringComparison.OrdinalIgnoreCase);

        var hasReversal = await connection.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(1) FROM dbo.CreditTransactions WITH (UPDLOCK, HOLDLOCK) WHERE TenantId = @TenantId AND OrderId = @OrderId AND Type = @Type;",
            new { TenantId = tenantId, OrderId = orderId, Type = type },
            transaction,
            cancellationToken: cancellationToken)) > 0;

        if (!wasPaid || hasReversal)
        {
            if (transaction is DbTransaction commitStatusTx) await commitStatusTx.CommitAsync(cancellationToken);
            else transaction.Commit();

            await _redisService.RemoveAsync($"order:tenant:{tenantId}:id:{orderId}", cancellationToken);
            if (!string.IsNullOrWhiteSpace(orderMeta.ExternalReference))
            {
                await _redisService.RemoveAsync($"order:tenant:{tenantId}:ref:{orderMeta.ExternalReference}", cancellationToken);
            }
            return (false, currentBalance);
        }

        const string sqlUpdateTenant = """
            UPDATE dbo.Tenants
            SET CreditsBalance = CreditsBalance - @Amount,
                UpdatedAt = SYSDATETIMEOFFSET()
            OUTPUT inserted.CreditsBalance
            WHERE Id = @TenantId;
        """;
        var newBalance = await connection.ExecuteScalarAsync<int?>(new CommandDefinition(
            sqlUpdateTenant,
            new { TenantId = tenantId, Amount = amount },
            transaction,
            cancellationToken: cancellationToken));

        if (!newBalance.HasValue)
        {
            throw new InvalidOperationException($"Tenant com Id '{tenantId}' não encontrado.");
        }

        if (newBalance.Value < 0)
        {
            await connection.ExecuteAsync(new CommandDefinition(
                "UPDATE dbo.Tenants SET IsActive = 0, UpdatedAt = SYSDATETIMEOFFSET() WHERE Id = @TenantId;",
                new { TenantId = tenantId },
                transaction,
                cancellationToken: cancellationToken));
        }

        const string sqlInsertLedger = """
            INSERT INTO dbo.CreditTransactions
            (Id, TenantId, OrderId, Amount, BalanceAfter, Type, Description, ReferenceId, CreatedAt)
            VALUES
            (@Id, @TenantId, @OrderId, @Amount, @BalanceAfter, @Type, @Description, @ReferenceId, SYSDATETIMEOFFSET());
        """;
        await connection.ExecuteAsync(new CommandDefinition(sqlInsertLedger, new
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            OrderId = orderId,
            Amount = -amount,
            BalanceAfter = newBalance.Value,
            Type = type,
            Description = description,
            ReferenceId = referenceId
        }, transaction, cancellationToken: cancellationToken));

        if (transaction is DbTransaction commitTx) await commitTx.CommitAsync(cancellationToken);
        else transaction.Commit();

        await _redisService.RemoveAsync(GetTenantCacheKey(tenantId), cancellationToken);
        await _redisService.RemoveAsync($"order:tenant:{tenantId}:id:{orderId}", cancellationToken);
        if (!string.IsNullOrWhiteSpace(orderMeta.ExternalReference))
        {
            await _redisService.RemoveAsync($"order:tenant:{tenantId}:ref:{orderMeta.ExternalReference}", cancellationToken);
        }

        return (true, newBalance.Value);
    }
}
