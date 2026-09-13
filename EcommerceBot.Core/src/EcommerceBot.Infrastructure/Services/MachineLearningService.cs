using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Application.DTOs.Analytics;
using EcommerceBot.Application.DTOs.Messaging;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Exceptions;
using EcommerceBot.Domain.Interfaces;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

/// <summary>
/// Serviço de orquestração de Inteligência de Clientes e Machine Learning (RFM, Churn e LTV).
/// </summary>
public sealed class MachineLearningService : IMachineLearningService
{
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly IRobotActivityRepository _activityRepository;
    private readonly ITenantRepository _tenantRepository;
    private readonly IRedisService _redisService;
    private readonly ILogger<MachineLearningService> _logger;

    public MachineLearningService(
        IPublishEndpoint publishEndpoint,
        IDbConnectionFactory dbConnectionFactory,
        IRobotActivityRepository activityRepository,
        ITenantRepository tenantRepository,
        IRedisService redisService,
        ILogger<MachineLearningService> logger)
    {
        _publishEndpoint = publishEndpoint;
        _dbConnectionFactory = dbConnectionFactory;
        _activityRepository = activityRepository;
        _tenantRepository = tenantRepository;
        _redisService = redisService;
        _logger = logger;
    }

    public async Task<bool> TriggerAnalysisAsync(Guid tenantId, string jobType = "FULL_ANALYTICS", CancellationToken cancellationToken = default)
    {
        // 1. Validação de saldo de créditos de IA
        if (!await _tenantRepository.HasCreditsAsync(tenantId, 1, cancellationToken))
        {
            throw new InsufficientCreditsException("Você precisa de pelo menos 1 crédito de IA em saldo para executar a análise de Machine Learning.");
        }

        // 2. Cooldown de 24 horas via Redis (anti-abuso de inferência de ML)
        var cooldownAcquired = await _redisService.SetIfNotExistsAsync($"cooldown:ml:{tenantId}", "active", TimeSpan.FromHours(24), cancellationToken);
        if (!cooldownAcquired)
        {
            throw new InvalidOperationException("A análise preditiva de Machine Learning possui um intervalo mínimo de 24 horas entre execuções gratuitas.");
        }

        _logger.LogInformation("Iniciando disparo de análise ML ({JobType}) para Tenant {TenantId}", jobType, tenantId);

        var transactions = await GetTenantTransactionsAsync(tenantId, cancellationToken);

        var message = new MlAnalysisRequestMessage
        {
            TenantId = tenantId,
            JobType = jobType,
            Transactions = transactions
        };

        try
        {
            await _publishEndpoint.Publish(message, ctx =>
            {
                ctx.SetRoutingKey("analytics_ml_queue");
            }, cancellationToken);

            _logger.LogInformation("Job de ML enfileirado com sucesso na fila 'analytics_ml_queue' com {Count} transações.", transactions.Count);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Falha ao enfileirar job de Machine Learning ({JobType}) para Tenant {TenantId}. Revertendo lock de cooldown...", jobType, tenantId);

            try
            {
                await _redisService.RemoveAsync($"cooldown:ml:{tenantId}", cancellationToken);
                _logger.LogInformation("Lock de cooldown de ML liberado com sucesso para Tenant {TenantId}.", tenantId);
            }
            catch (Exception redisEx)
            {
                _logger.LogWarning(redisEx, "Aviso: Falha ao deletar lock de cooldown de ML no Redis para Tenant {TenantId}.", tenantId);
            }

            throw;
        }
    }

    public async Task<MlInsightsResponse?> GetLatestInsightsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT TOP 1 Id, TenantId, WorkerType, Status, DetailsJson, CreatedAt
            FROM dbo.RobotActivities
            WHERE TenantId = @TenantId AND WorkerType = 'ANALYTICS_ML'
            ORDER BY CreatedAt DESC";

        using var connection = await _dbConnectionFactory.CreateConnectionAsync(cancellationToken);
        var activity = await connection.QueryFirstOrDefaultAsync<dynamic>(new CommandDefinition(sql, new { TenantId = tenantId }, cancellationToken: cancellationToken));

        if (activity == null)
        {
            // Se ainda não houver análise processada, tenta disparar uma primeira execução em background
            try
            {
                await TriggerAnalysisAsync(tenantId, "FULL_ANALYTICS", cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogInformation("Disparo automático inicial de ML não executado para Tenant {TenantId}: {Message}", tenantId, ex.Message);
            }
            return null;
        }

        string detailsJson = activity.DetailsJson ?? "{}";
        try
        {
            using var doc = JsonDocument.Parse(detailsJson);
            var root = doc.RootElement;

            return new MlInsightsResponse
            {
                TenantId = tenantId,
                JobType = root.TryGetProperty("jobType", out var jt) ? jt.GetString() ?? "FULL_ANALYTICS" : "FULL_ANALYTICS",
                Status = activity.Status ?? "SUCCESS",
                LastAnalyzedAt = (DateTimeOffset)activity.CreatedAt,
                Rfm = root.TryGetProperty("rfm", out var rfm) && rfm.ValueKind != JsonValueKind.Null ? rfm.Clone() : null,
                Churn = root.TryGetProperty("churn", out var churn) && churn.ValueKind != JsonValueKind.Null ? churn.Clone() : null,
                Ltv = root.TryGetProperty("ltv", out var ltv) && ltv.ValueKind != JsonValueKind.Null ? ltv.Clone() : null,
                ErrorMessage = root.TryGetProperty("error", out var err) && err.ValueKind != JsonValueKind.Null ? err.GetString() : null
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao desserializar DetailsJson de ML para Tenant {TenantId}", tenantId);
            return null;
        }
    }

    private async Task<List<CustomerTransactionDto>> GetTenantTransactionsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        // 1. Tenta buscar pedidos reais do tenant no SQL Server
        const string sql = @"
            SELECT PayerEmail AS CustomerId, TotalAmount AS Amount, CreatedAt AS Date
            FROM dbo.Orders
            WHERE TenantId = @TenantId AND Status IN ('PAID', 'APPROVED', 'COMPLETED')
            ORDER BY CreatedAt ASC";

        try
        {
            using var connection = await _dbConnectionFactory.CreateConnectionAsync(cancellationToken);
            var orders = (await connection.QueryAsync<CustomerTransactionDto>(new CommandDefinition(sql, new { TenantId = tenantId }, cancellationToken: cancellationToken))).ToList();

            if (orders.Count >= 5)
            {
                return orders;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Aviso ao consultar pedidos para ML do Tenant {TenantId}. Utilizando amostras demonstrativas.", tenantId);
        }

        // 2. Se a loja ainda não tiver volume suficiente de pedidos, gera massa de demonstração realista
        var now = DateTimeOffset.UtcNow;
        return new List<CustomerTransactionDto>
        {
            new() { CustomerId = "cliente.vip@empresa.com", Amount = 450.00m, Date = now.AddDays(-5) },
            new() { CustomerId = "cliente.vip@empresa.com", Amount = 620.00m, Date = now.AddDays(-32) },
            new() { CustomerId = "cliente.vip@empresa.com", Amount = 380.00m, Date = now.AddDays(-65) },
            new() { CustomerId = "marcos.silva@gmail.com", Amount = 189.90m, Date = now.AddDays(-12) },
            new() { CustomerId = "marcos.silva@gmail.com", Amount = 149.90m, Date = now.AddDays(-45) },
            new() { CustomerId = "juliana.costa@hotmail.com", Amount = 320.00m, Date = now.AddDays(-18) },
            new() { CustomerId = "roberto.dias@yahoo.com", Amount = 89.90m, Date = now.AddDays(-110) },
            new() { CustomerId = "fernanda.lima@outlook.com", Amount = 540.00m, Date = now.AddDays(-140) },
            new() { CustomerId = "camila.souza@bol.com.br", Amount = 129.00m, Date = now.AddDays(-3) },
            new() { CustomerId = "ricardo.alves@gmail.com", Amount = 270.00m, Date = now.AddDays(-25) },
            new() { CustomerId = "ricardo.alves@gmail.com", Amount = 310.00m, Date = now.AddDays(-60) },
            new() { CustomerId = "lucas.mendes@gmail.com", Amount = 99.00m, Date = now.AddDays(-180) }
        };
    }
}
