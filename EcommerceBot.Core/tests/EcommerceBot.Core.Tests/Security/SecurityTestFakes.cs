using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Integrations;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Application.Interfaces.Gateways;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using MassTransit;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.FileProviders;

namespace EcommerceBot.Core.Tests.Security;

internal sealed class InMemoryRedisService : IRedisService
{
    private readonly ConcurrentDictionary<string, (string Json, DateTimeOffset? ExpiresAt)> _store = new();

    public Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default)
    {
        if (!_store.TryGetValue(key, out var entry))
            return Task.FromResult<T?>(default);

        if (entry.ExpiresAt.HasValue && entry.ExpiresAt.Value <= DateTimeOffset.UtcNow)
        {
            _store.TryRemove(key, out _);
            return Task.FromResult<T?>(default);
        }

        if (typeof(T) == typeof(string))
        {
            var raw = JsonSerializer.Deserialize<string>(entry.Json);
            return Task.FromResult((T?)(object?)raw);
        }

        return Task.FromResult(JsonSerializer.Deserialize<T>(entry.Json));
    }

    public Task<bool> SetAsync<T>(string key, T value, TimeSpan? expiry = null, CancellationToken cancellationToken = default)
    {
        var json = JsonSerializer.Serialize(value);
        DateTimeOffset? expiresAt = expiry.HasValue ? DateTimeOffset.UtcNow.Add(expiry.Value) : null;
        _store[key] = (json, expiresAt);
        return Task.FromResult(true);
    }

    public Task<long> IncrementAsync(string key, long value = 1, TimeSpan? expiry = null) => Task.FromResult(value);

    public async Task<T?> GetOrCreateAsync<T>(string key, Func<Task<T>> factory, TimeSpan? expiry = null, CancellationToken cancellationToken = default)
    {
        var cached = await GetAsync<T>(key, cancellationToken);
        if (cached != null) return cached;
        var val = await factory();
        if (val != null) await SetAsync(key, val, expiry, cancellationToken);
        return val;
    }

    public Task<bool> RemoveAsync(string key, CancellationToken cancellationToken = default)
        => Task.FromResult(_store.TryRemove(key, out _));

    public Task<bool> KeyExistsAsync(string key, CancellationToken cancellationToken = default)
    {
        if (!_store.TryGetValue(key, out var entry))
            return Task.FromResult(false);
        if (entry.ExpiresAt.HasValue && entry.ExpiresAt.Value <= DateTimeOffset.UtcNow)
        {
            _store.TryRemove(key, out _);
            return Task.FromResult(false);
        }
        return Task.FromResult(true);
    }

    public Task<bool> SetIfNotExistsAsync(string key, string value, TimeSpan expiry, CancellationToken cancellationToken = default)
    {
        var entry = (JsonSerializer.Serialize(value), (DateTimeOffset?)DateTimeOffset.UtcNow.Add(expiry));
        return Task.FromResult(_store.TryAdd(key, entry));
    }

    public Task<long> PublishAsync(string channel, string message) => Task.FromResult(1L);
    public Task SubscribeAsync(string channel, Func<string, Task> handler) => Task.CompletedTask;
    public Task UnsubscribeAsync(string channel) => Task.CompletedTask;
}

internal sealed class InMemoryUserRepository : IUserRepository
{
    public ConcurrentDictionary<Guid, User> Users { get; } = new();

    public Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => Task.FromResult(Users.TryGetValue(id, out var user) ? user : null);

    public Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
        => Task.FromResult(Users.Values.FirstOrDefault(u => u.Email.Equals(email, StringComparison.OrdinalIgnoreCase)));

    public Task<User> CreateAsync(User user, CancellationToken cancellationToken = default)
    {
        if (user.Id == Guid.Empty) user.Id = Guid.NewGuid();
        user.CreatedAt = DateTimeOffset.UtcNow;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        Users[user.Id] = user;
        return Task.FromResult(user);
    }

    public Task<bool> UpdateAsync(User user, CancellationToken cancellationToken = default)
    {
        Users[user.Id] = user;
        return Task.FromResult(true);
    }
}

internal sealed class InMemoryTenantRepository : ITenantRepository
{
    public ConcurrentDictionary<Guid, Tenant> Tenants { get; } = new();
    public ConcurrentBag<CreditTransaction> Transactions { get; } = new();

    public Task<Tenant?> GetByIdAsync(Guid tenantId, CancellationToken cancellationToken = default)
        => Task.FromResult(Tenants.TryGetValue(tenantId, out var t) ? t : null);

    public Task<Tenant?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default)
        => Task.FromResult(Tenants.Values.FirstOrDefault(t => t.Slug == slug));

    public Task<bool> HasCreditsAsync(Guid tenantId, int requiredCredits = 1, CancellationToken cancellationToken = default)
        => Task.FromResult(Tenants.TryGetValue(tenantId, out var t) && t.IsActive && t.CreditsBalance >= requiredCredits);

    public Task<int> DeductCreditsAsync(Guid tenantId, int amount, string type = "PRODUCT_ENRICHMENT", string description = "", string? referenceId = null, Guid? orderId = null, CancellationToken cancellationToken = default)
        => Task.FromResult(0);

    public Task<int> AddCreditsAsync(Guid tenantId, int amount, string type = "RECHARGE", string description = "", string? referenceId = null, Guid? orderId = null, CancellationToken cancellationToken = default)
        => Task.FromResult(amount);

    public Task<int> ReverseCreditsAsync(Guid tenantId, int amount, string type = "CHARGEBACK_REVERSAL", string description = "", string? referenceId = null, Guid? orderId = null, CancellationToken cancellationToken = default)
        => Task.FromResult(0);

    public Task<IEnumerable<CreditTransaction>> GetCreditTransactionsAsync(Guid tenantId, int limit = 50, int offset = 0, string? type = null, CancellationToken cancellationToken = default)
        => Task.FromResult(Transactions.Where(t => t.TenantId == tenantId));

    public Task<int> CountCreditTransactionsAsync(Guid tenantId, string? type = null, CancellationToken cancellationToken = default)
        => Task.FromResult(Transactions.Count(t => t.TenantId == tenantId));

    public Task RecordTransactionAsync(CreditTransaction transaction, CancellationToken cancellationToken = default)
    {
        Transactions.Add(transaction);
        return Task.CompletedTask;
    }

    public Task AddManagedBalanceAsync(Guid tenantId, decimal amount, CancellationToken cancellationToken = default)
        => Task.CompletedTask;

    public Task<Tenant> CreateAsync(Tenant tenant, CancellationToken cancellationToken = default)
    {
        Tenants[tenant.Id] = tenant;
        return Task.FromResult(tenant);
    }
}

internal sealed class FakePublishEndpoint : IPublishEndpoint
{
    public ConcurrentBag<object> PublishedMessages { get; } = new();

    public ConnectHandle ConnectPublishObserver(IPublishObserver observer) => new DummyHandle();
    public Task Publish<T>(T message, CancellationToken cancellationToken = default) where T : class
    {
        PublishedMessages.Add(message);
        return Task.CompletedTask;
    }
    public Task Publish<T>(T message, IPipe<PublishContext<T>> publishPipe, CancellationToken cancellationToken = default) where T : class
    {
        PublishedMessages.Add(message);
        return Task.CompletedTask;
    }
    public Task Publish<T>(T message, IPipe<PublishContext> publishPipe, CancellationToken cancellationToken = default) where T : class
    {
        PublishedMessages.Add(message);
        return Task.CompletedTask;
    }
    public Task Publish(object message, CancellationToken cancellationToken = default)
    {
        PublishedMessages.Add(message);
        return Task.CompletedTask;
    }
    public Task Publish(object message, IPipe<PublishContext> publishPipe, CancellationToken cancellationToken = default)
    {
        PublishedMessages.Add(message);
        return Task.CompletedTask;
    }
    public Task Publish(object message, Type messageType, CancellationToken cancellationToken = default)
    {
        PublishedMessages.Add(message);
        return Task.CompletedTask;
    }
    public Task Publish(object message, Type messageType, IPipe<PublishContext> publishPipe, CancellationToken cancellationToken = default)
    {
        PublishedMessages.Add(message);
        return Task.CompletedTask;
    }
    public Task Publish<T>(object values, CancellationToken cancellationToken = default) where T : class => Task.CompletedTask;
    public Task Publish<T>(object values, IPipe<PublishContext<T>> publishPipe, CancellationToken cancellationToken = default) where T : class => Task.CompletedTask;
    public Task Publish<T>(object values, IPipe<PublishContext> publishPipe, CancellationToken cancellationToken = default) where T : class => Task.CompletedTask;

    private sealed class DummyHandle : ConnectHandle
    {
        public void Disconnect() { }
        public void Dispose() { }
    }
}

internal sealed class FakeWebHostEnvironment : IWebHostEnvironment
{
    public string WebRootPath { get; set; } = Path.GetTempPath();
    public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
    public string ApplicationName { get; set; } = "EcommerceBot.Tests";
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    public string ContentRootPath { get; set; } = Path.GetTempPath();
    public string EnvironmentName { get; set; } = "Production";
}

internal sealed class StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> responder) : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        => Task.FromResult(responder(request));
}

internal sealed class FakeStoreIntegrationRepository : IStoreIntegrationRepository
{
    public ConcurrentDictionary<Guid, StoreIntegration> Items { get; } = new();

    public Task<StoreIntegration?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => Task.FromResult(Items.TryGetValue(id, out var item) ? item : null);

    public Task<StoreIntegration?> GetByTenantAndPlatformAsync(Guid tenantId, string platform, CancellationToken cancellationToken = default)
        => Task.FromResult(Items.Values.FirstOrDefault(x => x.TenantId == tenantId && x.Platform.Equals(platform, StringComparison.OrdinalIgnoreCase)));

    public Task<StoreIntegration?> GetByDomainAsync(string platform, string storeDomain, CancellationToken cancellationToken = default)
        => Task.FromResult(Items.Values.FirstOrDefault(x => x.Platform.Equals(platform, StringComparison.OrdinalIgnoreCase) && x.StoreDomain == storeDomain));

    public Task<IEnumerable<StoreIntegration>> ListByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
        => Task.FromResult(Items.Values.Where(x => x.TenantId == tenantId));

    public Task<int> CountByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
        => Task.FromResult(Items.Values.Count(x => x.TenantId == tenantId && x.Status == "CONNECTED"));

    public Task UpsertAsync(StoreIntegration integration, CancellationToken cancellationToken = default)
    {
        if (integration.Id == Guid.Empty) integration.Id = Guid.NewGuid();
        Items[integration.Id] = integration;
        return Task.CompletedTask;
    }

    public Task<bool> DeleteAsync(Guid tenantId, Guid id, CancellationToken cancellationToken = default)
        => Task.FromResult(Items.TryRemove(id, out _));

    public Task UpdateHealthCheckAsync(Guid id, string status, int latencyMs, string healthMessage, CancellationToken cancellationToken = default)
        => Task.CompletedTask;

    public Task UpdateStatusAsync(Guid tenantId, string platform, string status, CancellationToken cancellationToken = default)
        => Task.CompletedTask;
}

internal sealed class FakeAesGcmCryptoService : IAesGcmCryptoService
{
    public EncryptedPayload Encrypt(string plainText)
        => new()
        {
            CipherText = Encoding.UTF8.GetBytes(plainText),
            Nonce = [1, 2, 3],
            Tag = [4, 5, 6]
        };

    public string Decrypt(EncryptedPayload encryptedPayload)
        => Encoding.UTF8.GetString(encryptedPayload.CipherText);
}

internal sealed class FakeProductRepository : IProductRepository
{
    public Task<Product?> GetBySkuAsync(Guid tenantId, string sku, CancellationToken cancellationToken = default) => Task.FromResult<Product?>(null);
    public Task<IEnumerable<Product>> GetProductsAsync(Guid tenantId, int page, int pageSize, CancellationToken cancellationToken = default) => Task.FromResult(Enumerable.Empty<Product>());
    public Task<Guid> AddAsync(Product product, CancellationToken cancellationToken = default) => Task.FromResult(Guid.NewGuid());
    public Task UpdateStatusAsync(Guid tenantId, string sku, string status, string? metadata = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
    public Task<(IEnumerable<Product> Products, int TotalCount)> GetPaginatedAsync(Guid tenantId, string? statusFilter, string? search, int page, int limit, CancellationToken cancellationToken = default) => Task.FromResult((Enumerable.Empty<Product>(), 0));
    public Task UpdateAsync(Product product, CancellationToken cancellationToken = default) => Task.CompletedTask;
    public Task DeleteAsync(Guid tenantId, string sku, CancellationToken cancellationToken = default) => Task.CompletedTask;
}

internal sealed class FakeEcommerceGateway : IEcommerceGateway
{
    public string PlatformName => "Shopify";
    public Task<bool> PushProductAsync(Guid tenantId, Product product, CancellationToken cancellationToken = default)
        => Task.FromResult(true);
    public Task<IEnumerable<Product>> FetchProductsAsync(Guid tenantId, CancellationToken cancellationToken = default)
        => Task.FromResult(Enumerable.Empty<Product>());
    public Task<(bool Success, int LatencyMs, string Message)> HealthCheckAsync(Guid tenantId, CancellationToken cancellationToken = default)
        => Task.FromResult((true, 10, "OK"));
    public Task<bool> UpdateInventoryAsync(Guid tenantId, string sku, int availableQuantity, string? inventoryItemId = null, CancellationToken cancellationToken = default)
        => Task.FromResult(true);
    public Task<bool> UpdateProductStatusAsync(Guid tenantId, string sku, string status, CancellationToken cancellationToken = default)
        => Task.FromResult(true);
    public Task<bool> DeleteProductAsync(Guid tenantId, string sku, CancellationToken cancellationToken = default)
        => Task.FromResult(true);
}

internal sealed class FakeEcommerceGatewayFactory : IEcommerceGatewayFactory
{
    public IEcommerceGateway GetGateway(string platform) => new FakeEcommerceGateway();
}
