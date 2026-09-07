---
name: csharp-best-practices
description: "Diretrizes obrigatórias de arquitetura, padrões C#, Clean Architecture, DDD, CQRS, injeção de dependências, persistência de alta performance, resiliência (Polly), observabilidade (Serilog) e segurança para o backend ASP.NET Core (EcommerceBot.Core)."
---

# ⚙️ Skill: Diretrizes de Backend ASP.NET Core (.NET 5) & C# 9.0

---

## 1. Visão Geral e Propósito

Este documento define os padrões obrigatórios de arquitetura, escrita de código, otimização de performance, resiliência e observabilidade para serviços backend desenvolvidos com C# 9.0 e ASP.NET Core. Toda geração e modificação de código neste repositório deve aderir estritamente a estas convenções.

---

## 2. Princípios de Arquitetura e Injeção de Dependências

### 2.1. Estrutura Arquitetural
- **Clean Architecture & DDD:** Isolar a camada de Domínio (*Domain*) de dependências tecnológicas externas; desacoplar a orquestração de casos de uso na camada de Aplicação (*Application*) e centralizar o acesso a infraestrutura (*Infrastructure*) e apresentação HTTP (*Web/API*).
- **CQRS com MediatR:** Segregar comandos de escrita e consultas de leitura via contratos explícitos.

### 2.2. Gestão do Ciclo de Vida do Container DI
- **Transient:** Apenas para serviços leves sem estado (cálculos rápidos, validadores).
- **Scoped:** Para serviços que acompanham o ciclo de vida da requisição HTTP (DbContext, Repositórios, Unit of Work).
- **Singleton:** Para instâncias com estado global e thread-safe (IMemoryCache, IConnectionMultiplexer, IHttpClientFactory).

> [!WARNING]
> **Anti-Pattern (Captive Dependency):** Nunca injete dependências com ciclo de vida `Scoped` diretamente em classes `Singleton`.

| Ciclo | Duração | Caso de Uso Primário | Risco Operacional |
|---|---|---|---|
| **Transient** | Nova instância por chamada | Mapeadores, validadores sem estado | Alocação repetitiva em loops |
| **Scoped** | Uma por requisição HTTP | DbContext, Unidades de Trabalho | Vazamento se capturado por Singleton |
| **Singleton** | Vida útil do processo | Caches, Pools de conexões de rede | *Race conditions* e estado compartilhado |

### 2.3. Resolução de Escopo em Background Services
Em `BackgroundService` ou `IHostedService`, injete `IServiceScopeFactory` para instanciar e descartar escopos manualmente para o acesso a dados:

```csharp
public sealed class ProcessingWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;

    public ProcessingWorker(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using (var scope = _scopeFactory.CreateScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                await dbContext.ProcessPendingQueueAsync(stoppingToken);
            }

            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
        }
    }
}
```

---

## 3. Padrões Idiomáticos do C# 9.0

### 3.1. Imutabilidade e Value Semantics
- **Records para DTOs e Comandos:** Use tipos `record` posicionais para comandos CQRS, eventos e DTOs de leitura.
- **Init-Only Setters:** Empregue acessores `init` em modelos de propriedades para assegurar imutabilidade pós-construção.
- **Mutações Não-Destrutivas:** Utilize a cláusula `with` ao derivar novos estados a partir de records existentes.

```csharp
// DTOs e Comandos imutáveis
public sealed record RegisterUserCommand(string Username, string Email, string Role);

public sealed class UserSummaryDto
{
    public Guid Id { get; init; }
    public string DisplayName { get; init; }
    public decimal Balance { get; init; }
}
```

### 3.2. Pattern Matching e Lambdas Estáticas
- **Pattern Matching Relacional e Lógico:** Substitua bifurcações aninhadas por expressões `switch` com `and`, `or`, `not` e comparadores relacionais.
- **Static Lambdas:** Em pipelines de processamento e operações LINQ críticas, utilize lambdas estáticas (`static (x) => ...`) para eliminar alocações desnecessárias de closures na heap.
- **Target-Typed New:** Reduza redundâncias sintáticas ao instanciar tipos já explicitamente definidos.

```csharp
// Exemplo de Pattern Matching e Static Lambdas
public static decimal CalculateDiscount(decimal amount, bool isVip) =>
    (amount, isVip) switch
    {
        ( > 5000m, true) => 0.25m,
        ( > 5000m, false) => 0.10m,
        ( >= 1000m and <= 5000m, _) => 0.05m,
        _ => 0.0m
    };

// Evitando alocações de closure na heap
var activeItems = items.Where(static item => item.IsActive).ToList();
```

---

## 4. Engenharia de Desempenho e Memória

### 4.1. Regras do Thread Pool e Concorrência Assíncrona
- **Proibição de Bloqueios Síncronos:** É estritamente proibido o uso de `.Result`, `.Wait()` e `.GetAwaiter().GetResult()` em rotinas assíncronas para prevenir *Thread Pool Starvation*.
- **Banir async void:** Sempre retorne `Task` ou `ValueTask`. Métodos `async void` causam o crash do processo em caso de exceção.
- **Evitar Task.Run no Pipeline HTTP:** O Kestrel já despacha solicitações em threads do pool; delegar trabalho I/O-bound para `Task.Run` introduz overhead inútil de chaveamento de contexto.

### 4.2. Hot Paths e Redução de GC Pressure
- **Manipulação com Span&lt;T&gt; e ReadOnlySpan&lt;T&gt;:** Em tarefas intensivas de parsing e fatiamento de strings, utilize `ReadOnlySpan<char>` para evitar novas alocações na heap.
- **Reaproveitamento de Buffers com ArrayPool&lt;T&gt;:** Alugue matrizes de bytes em fluxos pesados e garanta a devolução ao pool em blocos `finally`.
- **Streaming de Dados com IAsyncEnumerable&lt;T&gt;:** Para grandes conjuntos de dados transmitidos via HTTP, adote `IAsyncEnumerable<T>` para evitar a materialização de listas em memória no servidor.
- **Alta Densidade com System.IO.Pipelines:** Para ingestão direta de streams de rede com *zero-copy parsing*, utilize `PipeReader` e `PipeWriter`.

```csharp
// Extração de token com ReadOnlySpan (Zero Heap Allocation)
public static bool TryParseBearer(ReadOnlySpan<char> headerValue, out ReadOnlySpan<char> token)
{
    const string prefix = "Bearer ";
    if (headerValue.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
    {
        token = headerValue.Slice(prefix.Length).Trim();
        return true;
    }

    token = ReadOnlySpan<char>.Empty;
    return false;
}
```

---

## 5. Persistência de Alta Performance (EF Core 5.0)

### 5.1. Pool de Contextos (AddDbContextPool)
Utilize pooling de instâncias para evitar a sobrecarga de inicialização do `DbContext` em requisições de alta frequência:

```csharp
services.AddDbContextPool<ApplicationDbContext>(options =>
{
    options.UseSqlServer(connectionString, sql =>
    {
        sql.EnableRetryOnFailure(maxRetryCount: 3, maxRetryDelay: TimeSpan.FromSeconds(5), errorNumbersToAdd: null);
        sql.CommandTimeout(30);
    });
}, poolSize: 1024);
```

### 5.2. Otimização de Consultas de Leitura
- **AsNoTracking:** Desative o Change Tracker em rotinas puramente de consulta.
- **AsNoTrackingWithIdentityResolution:** Utilize ao incluir múltiplos relacionamentos para manter a consistência de instâncias sem o custo do rastreador.
- **AsSplitQuery:** Aplique em consultas com múltiplos `.Include()` sobre coleções 1:N para erradicar a explosão cartesiana de dados no banco.

```csharp
var orders = await dbContext.Orders
    .Include(o => o.Items)
    .Include(o => o.Payments)
    .AsSplitQuery()
    .AsNoTrackingWithIdentityResolution()
    .Where(o => o.CustomerId == customerId)
    .ToListAsync(cancellationToken);
```

### 5.3. Paginação Eficiente: Keyset Pagination ($O(1)$)
Evite paginação baseada em deslocamento (`Skip`/`Take` gerando `OFFSET`/`FETCH`), cujo custo computacional cresce linearmente com a profundidade da página ($O(N)$). Adote cursores indexados:

| Critério | Keyset Pagination (Seek) | Offset Pagination (Skip/Take) |
|---|---|---|
| **Complexidade** | Tempo constante ($O(1)$) | Tempo linear ($O(N)$) |
| **Desempenho I/O** | Seek direto no índice | Varredura e descarte de linhas prévias |
| **Concorrência** | Consistente sob inserções/exclusões concorrentes | Risco de registros duplicados/pulados |

```csharp
// Keyset Pagination padrão
public static async Task<List<ProductDto>> GetPagedProductsAsync(
    ApplicationDbContext db, 
    int lastSeenId, 
    int pageSize, 
    CancellationToken ct)
{
    return await db.Products
        .AsNoTracking()
        .Where(p => p.Id > lastSeenId)
        .OrderBy(p => p.Id)
        .Take(pageSize)
        .Select(p => new ProductDto(p.Id, p.Name, p.Price))
        .ToListAsync(ct);
}
```

> [!IMPORTANT]
> **Atenção:** Não utilize `COUNT(*)` indiscriminadamente em listagens para APIs, pois ele invalida os ganhos do índice forçando escaneamentos desnecessários.

---

## 6. Caching Multicamadas e Proteção de Concorrência

### 6.1. Topologia L1 / L2
- **Cache L1 (In-Memory):** Utilizar `IMemoryCache` para leitura local de baixa latência e dados críticos.
- **Cache L2 (Distribuído):** Utilizar Redis via `IDistributedCache` para sincronismo entre múltiplas instâncias da aplicação.

### 6.2. Prevenção de Cache Stampede (Double-Checked Locking)
Quando um dado com alta demanda expira, múltiplas requisições simultâneas não devem sobrecarregar o banco de dados. Utilize `SemaphoreSlim` por chave e adicione Jitter pseudoaleatório ao TTL:

```csharp
public sealed class ThreadSafeCacheService
{
    private readonly IMemoryCache _memoryCache;
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> _keyedLocks = new();

    public ThreadSafeCacheService(IMemoryCache memoryCache)
    {
        _memoryCache = memoryCache;
    }

    public async Task<T> GetOrCreateAsync<T>(string key, Func<Task<T>> factory, TimeSpan baseDuration)
    {
        if (_memoryCache.TryGetValue(key, out T cachedItem))
            return cachedItem;

        var semaphore = _keyedLocks.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
        await semaphore.WaitAsync();

        try
        {
            if (_memoryCache.TryGetValue(key, out cachedItem))
                return cachedItem;

            T item = await factory();

            // Aplicação de Jitter aleatório de até 10%
            var jitterMs = Random.Shared.Next(0, (int)(baseDuration.TotalMilliseconds * 0.1));
            var ttl = baseDuration + TimeSpan.FromMilliseconds(jitterMs);

            _memoryCache.Set(key, item, new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = ttl,
                SlidingExpiration = TimeSpan.FromMinutes(2)
            });

            return item;
        }
        finally
        {
            semaphore.Release();
        }
    }
}
```

---

## 7. Resiliência e Gestão de Erros

### 7.1. Padronização com RFC 7807 (ProblemDetails)
Todas as falhas não tratadas devem ser interceptadas por um Middleware Global e devolvidas no formato padrão RFC 7807 (`application/problem+json`), sem expor rastreamento de pilha sensível ao consumidor:

```csharp
public sealed class GlobalExceptionMiddleware : IMiddleware
{
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    public GlobalExceptionMiddleware(ILogger<GlobalExceptionMiddleware> logger)
    {
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro de processamento não capturado.");

            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/problem+json";

            var problem = new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Type = "https://datatracker.ietf.org/doc/html/rfc7807",
                Title = "Erro interno no processamento",
                Detail = "Consulte o suporte informando o correlationId.",
                Instance = context.Request.Path
            };
            problem.Extensions["correlationId"] = Activity.Current?.Id ?? context.TraceIdentifier;

            await context.Response.WriteAsync(JsonSerializer.Serialize(problem));
        }
    }
}
```

### 7.2. Clientes HTTP Resilientes com Polly
Nunca instancie `HttpClient` diretamente com o comando `new`. Utilize `IHttpClientFactory` acoplado com políticas de retentativa com recuo exponencial e jitter descorrelacionado, além de Circuit Breaker:

```csharp
services.AddHttpClient("ExternalService", client =>
{
    client.BaseAddress = new Uri("https://api.upstream.com/");
    client.Timeout = TimeSpan.FromSeconds(10);
})
.AddPolicyHandler(HttpPolicyExtensions
    .HandleTransientHttpError()
    .OrResult(msg => msg.StatusCode == HttpStatusCode.TooManyRequests)
    .WaitAndRetryAsync(
        retryCount: 3, 
        sleepDurationProvider: attempt =>
            TimeSpan.FromSeconds(Math.Pow(2, attempt)) + 
            TimeSpan.FromMilliseconds(Random.Shared.Next(0, 300))))
.AddPolicyHandler(HttpPolicyExtensions
    .HandleTransientHttpError()
    .CircuitBreakerAsync(
        handledEventsAllowedBeforeBreaking: 5, 
        durationOfBreak: TimeSpan.FromSeconds(30)));
```

---

## 8. Observabilidade, Validação e Segurança

### 8.1. Validação Transversal com FluentValidation
Implemente `IPipelineBehavior` no MediatR para interceptar comandos antes dos Handlers de negócio, garantindo que requisições inconsistentes sejam rejeitadas no limite da aplicação com status HTTP 400:

```csharp
public sealed class ValidationBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : IRequest<TResponse>
{
    private readonly IEnumerable<IValidator<TRequest>> _validators;

    public ValidationBehavior(IEnumerable<IValidator<TRequest>> validators)
    {
        _validators = validators;
    }

    public async Task<TResponse> Handle(TRequest request, CancellationToken ct, RequestHandlerDelegate<TResponse> next)
    {
        if (_validators.Any())
        {
            var ctx = new ValidationContext<TRequest>(request);
            var results = await Task.WhenAll(_validators.Select(v => v.ValidateAsync(ctx, ct)));
            var failures = results.SelectMany(r => r.Errors).Where(f => f != null).ToList();

            if (failures.Count != 0)
                throw new FluentValidation.ValidationException(failures);
        }

        return await next();
    }
}
```

### 8.2. Logging Estruturado (Serilog)
- **Templates Nomeados:** Nunca use interpolação simples de strings em mensagens de log (`$""`), pois ela gera alocações e inviabiliza buscas indexadas por propriedades estruturadas.
- **LogContext e CorrelationId:** Enriqueça o escopo de cada chamada com identificadores únicos rastreáveis em serviços como Elasticsearch e Datadog.

```csharp
// CORRETO: Propriedades estruturadas
_logger.LogInformation("Pedido {OrderId} faturado para o cliente {CustomerId}", orderId, customerId);

// INCORRETO: Proibido o uso de interpolação
_logger.LogInformation($"Pedido {orderId} faturado para o cliente {customerId}");
```

### 8.3. Sondas de Saúde e Segurança de Tokens JWT
- **Health Checks Segregados:**
  - `/health/live`: Verifica unicamente a integridade interna do processo (sonda leve, sem conexões com bancos ou redes externas).
  - `/health/ready`: Testa ativamente a prontidão de dependências essenciais (banco de dados, Redis, filas).
- **Configuração de JWT:**
  - Definir `ValidateIssuerSigningKey = true`.
  - Reduzir a tolerância de `ClockSkew` de 5 minutos (padrão) para zero ou no máximo 1 minuto, impedindo o uso indevido de tokens expirados.