# 🤖 E-commerce Bot — Guia Mestre de Arquitetura & Instruções para Agentes de IA

Este documento é a **Fonte Canônica da Verdade** sobre a arquitetura, regras de segurança, convenções de código, persistência, mensageria e diretrizes de desenvolvimento do ecossistema **E-commerce Bot**.

> **⚠️ AVISO OBRIGATÓRIO PARA AGENTES DE IA:**  
> Você DEVE consultar e seguir rigorosamente estas diretrizes em qualquer criação, modificação, refatoração ou auditoria de código neste repositório. Nunca ignore regras de segurança, isolamento multi-tenant ou verificação runtime.

---

## 📐 1. Visão Geral da Arquitetura

O **E-commerce Bot** é uma plataforma SaaS monorepo escalável dividida em 4 pilares:

1. **Frontend Web SPA (`EcommerceBot.Web`):** React 18 + TypeScript + Vite + Tailwind CSS.
2. **Core API Central (`EcommerceBot.Core`):** ASP.NET Core Web API em .NET 8 (C#) seguindo Clean Architecture / DDD, responsável por autenticação, autorização, regras de negócio, persistência Dapper, pagamentos e orquestração.
3. **AI/ML Engine (`EcommerceBot.Worker`):** Microsserviço Python (FastAPI + Workers) focado estritamente em inferência LLM (OpenRouter/DeepSeek), Scraping inteligente e Machine Learning preditivo. **Sem acesso direto ao banco de dados** (comunicação 100% via RabbitMQ).
4. **Database & Migrations (`Database.Migrations`):** Runner de migrações determinísticas em .NET 8 com DbUp para **Microsoft SQL Server 2022**.

```text
                               ┌────────────────────────────────────────┐
                               │     EcommerceBot.Web (React + Vite)    │
                               └──────────────────┬─────────────────────┘
                                                  │ HTTP / SSE (/api/v1, X-Tenant-ID, Cookie JWT)
                                                  ▼
                               ┌────────────────────────────────────────┐
                               │    EcommerceBot.Core (API .NET 8)      │
                               │  • Auth JWT & Multi-Tenancy Estrito    │
                               │  • Dapper + SQL Server 2022            │
                               │  • Mercado Pago (PIX / CC / Preapproval│
                               │  • Shopify (GraphQL) & Nuvemshop (REST)│
                               │  • MassTransit Producer & Consumers    │
                               │  • Redis Cache, RateLimit & SSE Stream │
                               └───────┬────────────────────────┬───────┘
                                       │                        │
               queue:ecommerce (RabbitMQ)                       │ analytics_ml_queue
                                       │                        │
                                       ▼                        ▼
                               ┌────────────────────────────────────────┐
                               │  EcommerceBot.Worker (Python AI Engine)│
                               │  • ScraperWorker (JSON-LD + Markdown)  │
                               │  • LLMEngineRouter (OpenRouter Fallback│
                               │  • Scikit-Learn (RFM, Churn, LTV)      │
                               │  • Telemetria de Tokens e Latência     │
                               └────────────────────────────────────────┘
```

---

## 📁 2. Estrutura do Monorepo

```
ecommerce-bot/
├── .agents/
│   ├── AGENTS.md               # Fonte da Verdade Universal para Agentes de IA
│   └── skills/                 # Skills especializadas (sqlserver-dba, production-security, etc.)
├── Database.Migrations/        # 🔷 Projeto .NET 8 com DbUp para SQL Server 2022
│   ├── Database.Migrations.csproj # Runner de migrações determinísticas
│   ├── Program.cs              # Execução CLI/Startup com transações por script
│   └── Scripts/                # DDL T-SQL idempotente versionado (001 a 011)
│       ├── 001_Initial_Tenancy_And_Users.sql
│       ├── 002_Products_And_Catalog.sql
│       ├── 003_Financial_Plans_And_Subscriptions.sql
│       ├── 004_Traffic_And_Attributions.sql
│       ├── 005_Diagnostic_DMV_Views.sql
│       ├── 006_Auth_And_EnterpriseLeads.sql
│       ├── 007_LLMUsageLogs_And_Balance.sql
│       ├── 008_Checkout_OrderItems.sql
│       ├── 009_EmailLogs.sql
│       ├── 010_Tenant_Configs.sql
│       └── 011_RobotActivities.sql
├── EcommerceBot.Core/          # ⚡ API Central em .NET 8 (C#) - Clean Architecture
│   ├── EcommerceBot.Core.sln
│   └── src/
│       ├── EcommerceBot.Domain/         # Entidades, Enums e Interfaces de Repositório
│       ├── EcommerceBot.Application/    # DTOs, Interfaces de Serviço, Contratos
│       ├── EcommerceBot.Infrastructure/ # Dapper, MassTransit, Redis, Gateways, Serviços
│       └── EcommerceBot.Api/            # ASP.NET Core Web API (Controllers, Middlewares)
├── EcommerceBot.Worker/        # 🐍 AI & ML Engine em Python (Sem acesso a DB)
│   ├── app/
│   │   ├── main.py             # Entrypoint e Lifespan workers (RabbitMQ aio-pika)
│   │   ├── ai/                 # OpenRouterLLMProvider, Tenacity Retries
│   │   ├── scraper/            # ScraperWorker, JsonLdParser, MarkdownParser
│   │   └── ml/                 # Modelos Scikit-Learn (RFM, Churn, LTV)
│   ├── Dockerfile
│   └── requirements.txt
├── EcommerceBot.Web/           # 🔵 Frontend Web SPA (React 18 + TypeScript + Vite + Tailwind)
│   ├── src/
│   │   ├── components/ui/      # Atomic Design System (Botões, Modais, Inputs)
│   │   ├── features/           # Módulos DDD (Auth, Catalog, Settings, Analytics)
│   │   ├── layouts/            # Layouts responsivos e Shell
│   │   └── lib/                # apiClient (Axios JWT/Tenant) e sseClient (EventSource)
│   ├── package.json
│   └── vite.config.ts
├── infra/                      # 🛠️ Infraestrutura e Deploy Dev/Prod
│   ├── dev/                    # docker-compose.dev.yml (MSSQL 2022, Redis, RabbitMQ)
│   └── prod/                   # docker-compose.prod.yml, scripts de manutenção e backups Cloudflare R2
│       ├── nginx/              # Configuração Nginx com SSL e proxy SSE
│       └── scripts/            # setup_sqlserver_maintenance.sh, backup_sqlserver_r2.sh, restore_sqlserver_test.sh
└── .gitignore                  # Exclusões de build, logs, volumes e secrets
```

---

## 🔒 3. Regras Críticas de Segurança SaaS (Invioláveis)

### 3.1. Gestão de Segredos & Modo Fail-Closed
- **NUNCA use fallbacks estáticos para segredos em produção:**
  - ❌ `var jwtKey = config["Jwt:Key"] ?? "ChavePadrao123";`
  - ✅ `var jwtKey = config["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key is mandatory.");`
- Em ambiente de desenvolvimento (`Environment.IsDevelopment()`), utilize logs explícitos ao inicializar chaves locais seguras.

### 3.2. Prevenção de Escalação de Privilégios & Mass Assignment
- **Criação de Usuários:** Todo auto-registro (`RegisterUserAsync`) DEVE forçar o papel padrão `Role = "MEMBER"`.
- **Atualização de Perfil:** `UpdateProfileAsync` NUNCA deve aceitar ou alterar o campo `Role` vindo do cliente comum. A alteração de papéis requer endpoints administrativos protegidos por `[Authorize(Roles = "ADMIN")]`.

### 3.3. Isolamento Multi-Tenant & Prevenção de IDOR
- **`TenantHeaderMiddleware`:**
  - Validação de Pertencimento: Para requisições autenticadas de usuários não-admin, o middleware valida obrigatoriamente se o `X-Tenant-ID` do cabeçalho confere com a claim `tenantId` do token JWT. Caso divirja, retorna `403 Forbidden`.
  - Isenção de Rotas Públicas: Rotas como `/health`, `/openapi`, endpoints de login/registro (`/api/v1/auth/*`), catálogo público de planos (`GET /api/v1/plans`) e webhooks externos (`/api/v1/webhooks/*`, `/api/v1/emails/webhooks/*`, `/api/v1/shopify/*`, `/api/v1/nuvemshop/*`) são isentas da obrigatoriedade do header `X-Tenant-ID`.
- **Dapper Queries:** Toda query Dapper em tabelas multi-tenant DEVE conter obrigatoriamente `WHERE TenantId = @TenantId`.

### 3.4. Blindagem de Webhooks (HMAC, Timing Attacks & Idempotência)
- **Comparação Criptográfica:** Sempre utilize tempo constante para validação de assinaturas HMAC/Svix para prevenir *Timing Attacks*:
  - ✅ `CryptographicOperations.FixedTimeEquals(calculatedBytes, headerBytes)`
- **Idempotência no Redis:** Todo webhook transacional (Mercado Pago, Resend, Shopify, Nuvemshop) DEVE registrar a chave de idempotência com TTL de 24 horas usando `SET NX` (`StringSetAsync(key, "processed", TimeSpan.FromHours(24), When.NotExists)`). Se a chave já existir, retorne `200 OK` imediatamente sem reprocessar.

### 3.5. Proteção Anti-SSRF no Scraper
- Todas as URLs de produtos ou extração fornecidas por usuários DEVEM ser validadas antes do enfileiramento:
  - Permitir estritamente esquemas `http://` e `https://`.
  - Bloquear terminantemente `localhost`, loopbacks (`127.0.0.0/8`, `::1`), faixas privadas RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) e metadados de nuvem (`169.254.169.254`, `0.0.0.0`).

### 3.6. Proteção de Endpoints Internos e Financeiros
- Endpoints de ajuste de créditos e telemetria interna (`/api/v1/Metering/internal/*`) DEVEM ser restritos via chave secreta interna (`X-Internal-Secret` com validação de tempo constante) ou autorização por roles `ADMIN`/`SYSTEM`.

---

## 🗄️ 4. Padrão Canônico SQL Server 2022 & DbUp (.NET 8)

Consulte a skill [`sqlserver-dba`](file:///c:/Users/digob/Desktop/ecommerce-bot/.agents/skills/sqlserver-dba/SKILL.md):

### 4.1. Convenções Obrigatórias de Modelagem T-SQL:
1. **Identificadores (IDs):** `UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID()` (evita fragmentação de páginas B-Tree).
2. **Isolamento Multi-Tenant:** Coluna `TenantId UNIQUEIDENTIFIER NOT NULL` com FK para `dbo.Tenants(Id) ON DELETE CASCADE`.
3. **Campos Temporais:** `DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()` (preserva UTC com precisão milimétrica).
4. **Criptografia BYOK:** `VARBINARY(MAX)` para chaves criptografadas via AES-256 GCM (`InitializationVector VARBINARY(32)`, `AuthTag VARBINARY(32)`).
5. **Modelo Dual de Saldos no SaaS (`dbo.Tenants`):**
   - `CreditsBalance INT NOT NULL DEFAULT 0`: Cota de extrações/produtos do bot (ex: 500 produtos/mês).
   - `ManagedCreditBalance DECIMAL(18,6) NOT NULL DEFAULT 0.000000`: Saldo financeiro para inferência de modelos LLM gerenciados.
   - `IsByok BIT`: Quando ativado, requisições de IA utilizam a chave do cliente e não debitam do `ManagedCreditBalance`.

### 4.2. Estratégia de Índices de Cobertura & Filtros:
- **Covering Indexes (`INCLUDE`):** Em rotas de listagem frequente, inclua colunas selecionadas para eliminar *Key Lookups*:
  ```sql
  CREATE NONCLUSTERED INDEX IX_Products_Tenant_Status_CreatedAt
  ON dbo.Products (TenantId, Status, CreatedAt DESC)
  INCLUDE (Sku, Title, Price, Brand, Category, StockQuantity);
  ```
- **Filtered Indexes:** Para filas de processamento:
  ```sql
  CREATE NONCLUSTERED INDEX IX_Products_Pending_Processing
  ON dbo.Products (TenantId, CreatedAt)
  INCLUDE (Sku, Title, SourceUrl)
  WHERE Status = 'RAW';
  ```

---

## 📡 5. Contratos de Mensageria MassTransit & RabbitMQ

O ecossistema utiliza `MassTransit` com `cfg.UseRawJsonSerializer()` para garantir interoperabilidade total com o worker Python.

### 5.1. Filas e Tópicos Canônicos:
- **`queue:ecommerce` / `queue:demo_ecommerce`:** Enfileiramento de requisições de extração de produto (`ImportRequestMessage` / `ScrapingRequestMessage`).
- **`ecommerce_processed_queue`:** Consumida por `ProcessedProductConsumer` para persistir o enriquecimento de IA no Dapper e disparar SSE para o Frontend via Redis Pub/Sub.
- **`email_notifications`:** Consumida por `EmailNotificationConsumer` para envio transacional via Resend Gateway.
- **`nuvemshop_bulk_sync`:** Consumida por `NuvemshopBulkSyncConsumer` para sincronização de catálogo.

---

## 🎨 6. Regras de Frontend (`ecom-autobot-web`)

- **Padrão em 4 Camadas:** `Types -> Services -> Hooks -> UI Components`.
- **Autenticação:** Cookies `HttpOnly` com token JWT (`access_token`) e envio automático do header `X-Tenant-ID` através de interceptors do Axios (`apiClient.ts`).
- **SSE (Server-Sent Events):** O cliente SSE conecta em `/api/v1/demo/stream`, consumindo o canal Redis `events:tenant:{tenantId}` em tempo real.
- **Mobile-First & A11y:** Touch targets mínimos de 44px (`min-h-[44px]`), sem auto-zoom no iOS (`font-size >= 16px`), contraste de cores conforme WCAG 2.1 AA.

---

## 🚨 7. Diretrizes Fundamentais para Agentes de IA

1. **Modularidade (Anti-Monólito):** Mantenha arquivos menores que 300 linhas aplicando o Princípio da Responsabilidade Única (SRP).
2. **Código Assíncrono:** No .NET, use sempre `Task`, `async/await` e `IDbConnection.QueryAsync`. No Python, use `async def`, `httpx.AsyncClient` e `aio-pika`.
3. **Análise de Raio de Impacto:** Valide toda a cadeia de dados antes de alterar contratos:
   `UI Component -> Hook -> API Controller -> Service -> Dapper Repository -> SQL Server 2022` + `RabbitMQ -> Python Worker`.
4. **Prevenção de Colisão de Rotas:** NUNCA crie múltiplos Controllers com rotas HTTP idênticas (ex: `ProductController` vs `ProductsController` gera `AmbiguousMatchException`).
5. **Verificação Runtime Obrigatória:** NUNCA considere uma tarefa concluída sem testar a compilação:
   - Backend Core: `dotnet build EcommerceBot.Core`
   - Migrações: `dotnet build Database.Migrations`
   - Frontend Web: `npm run build` (em `EcommerceBot.Web`)
   - Análise Estática: Varredura de segurança com Semgrep.

