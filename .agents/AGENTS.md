# 🤖 E-commerce Bot — Guia Mestre de Arquitetura & Instruções para Agentes de IA

Este documento é a **Fonte Canônica da Verdade** sobre a arquitetura, regras de segurança, convenções de código, persistência, mensageria e diretrizes de desenvolvimento do ecossistema **E-commerce Bot**.

---

## ⛔ PROIBIÇÕES ABSOLUTAS (FAIL-CLOSED)
A violação de qualquer uma das regras abaixo invalida a entrega e interrompe a execução imediatamente:

1. **PROIBIDO queries Dapper sem filtro de tenant:** Toda consulta ou comando T-SQL em tabelas multi-tenant DEVE conter obrigatoriamente `WHERE TenantId = @TenantId` via parâmetros tipados.
2. **PROIBIDO acesso a banco no Python Worker:** O microsserviço `EcommerceBot.Worker` NUNCA deve importar bibliotecas de banco (`sqlalchemy`, `databases`, `psycopg`, `psycopg2`, `asyncpg`, `pyodbc`, `pymssql`, `tortoise-orm`). Sua comunicação é estritamente via RabbitMQ e Redis.
3. **PROIBIDO fallbacks estáticos para segredos:** NUNCA utilize operadores de fallback para chaves críticas (`?? "default_secret"`). Dispare `InvalidOperationException` imediatamente.
4. **PROIBIDO escalação de privilégios:** Endpoints comuns de perfil (`UpdateProfileAsync`) NUNCA devem aceitar ou atualizar a claim/coluna `Role`. Registros novos recebem estritamente `Role = "MEMBER"`.
5. **PROIBIDO colisão de rotas HTTP:** NUNCA declare múltiplos Controllers ou Actions com paths idênticos no ASP.NET Core (`AmbiguousMatchException`).
6. **PROIBIDO validação insegura de HMAC:** NUNCA compare assinaturas de webhooks com operadores de igualdade padrão (`==` ou `.Equals()`). Use exclusivamente `CryptographicOperations.FixedTimeEquals`.

---

## 🏛️ 1. Hierarquia de Contexto Cognitivo (4 Camadas)

Para evitar alucinações e perda de atenção (*Lost in the Middle*), opere estritamente sob a seguinte precedência de regras:

```text
┌──────────────────────────────────────────────────────────────┐
│  NÍVEL 0: PROMPT ATUAL DO ENGENHEIRO (Tarefa Imediata)       │
├──────────────────────────────────────────────────────────────┤
│  NÍVEL 1: AGENTS.md (Constituição Inviolável do Monorepo)    │
├──────────────────────────────────────────────────────────────┤
│  NÍVEL 2: SKILL ESPECÍFICA DO DOMÍNIO (Backend OU Frontend)  │
├──────────────────────────────────────────────────────────────┤
│  NÍVEL 3: GRAFO DE TOPOLOGIA (GRAPH_REPORT.md / graph.json)  │
└──────────────────────────────────────────────────────────────┘
```

**Regra de Isolamento de Skills:** Em tarefas de backend/banco, ative apenas `sqlserver-dba` e `production-security`. Em tarefas de interface, ative apenas `impeccable`. NUNCA injete skills de UI em tarefas de infraestrutura ou persistência.

---

## 📐 2. Visão Geral da Arquitetura

O **E-commerce Bot** é uma plataforma SaaS monorepo dividida em 4 pilares:

1. **Frontend Web SPA (`EcommerceBot.Web`):** React 18 + TypeScript + Vite + Tailwind CSS.
2. **Core API Central (`EcommerceBot.Core`):** ASP.NET Core Web API em .NET 8/9 (C#) em Clean Architecture / DDD, Dapper + T-SQL puro, pagamentos e orquestração.
3. **AI/ML Engine (`EcommerceBot.Worker`):** Microsserviço Python assíncrono (FastAPI + Workers) para scraping, inferência LLM (OpenRouter) e modelos Scikit-Learn. Isolado de qualquer banco de dados.
4. **Database & Migrations (`Database.Migrations`):** Runner de migrações determinísticas em .NET com DbUp para Microsoft SQL Server 2022.

```text
                               ┌────────────────────────────────────────┐
                               │     EcommerceBot.Web (React + Vite)    │
                               └──────────────────┬─────────────────────┘
                                                  │ HTTP / SSE (/api/v1, X-Tenant-ID, Cookie JWT)
                                                  ▼
                               ┌────────────────────────────────────────┐
                               │    EcommerceBot.Core (API .NET 8/9)    │
                               │  • Auth JWT & Multi-Tenancy Estrito    │
                               │  • Dapper + SQL Server 2022            │
                               │  • Mercado Pago (PIX / CC / Recurring) │
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
                               │  • ScraperWorker (JSON-LD + Scrapling) │
                               │  • LLMEngineRouter (OpenRouter Fallback│
                               │  • Scikit-Learn (RFM, Churn, LTV)      │
                               │  • Telemetria de Tokens e Latência     │
                               └────────────────────────────────────────┘
```

---

## 🔒 3. Regras Críticas de Segurança SaaS

### 3.1. Isolamento Multi-Tenant & Validação de Cabeçalho
- **`TenantHeaderMiddleware`:** Toda requisição autenticada de usuário não-admin valida se o header `X-Tenant-ID` confere com a claim `tenantId` do JWT. Divergências retornam `403 Forbidden`.
- **Rotas Isentas de Header:** Endpoints de saúde (`/health`), documentação (`/openapi`), autenticação (`/api/v1/auth/*`), catálogo público (`GET /api/v1/plans`) e webhooks públicos (`/api/v1/webhooks/*`, `/api/v1/emails/webhooks/*`, `/api/v1/shopify/*`, `/api/v1/nuvemshop/*`).

### 3.2. Idempotência e Webhooks
- **Idempotência no Redis:** Chave registrada com TTL de 24h via `SET NX` (`StringSetAsync($"webhook:idempotency:{id}", "processed", TimeSpan.FromHours(24), When.NotExists)`). Duplicidades respondem imediatamente `200 OK`.
- **Tempo Constante:** Validações de HMAC devem usar `CryptographicOperations.FixedTimeEquals`.

### 3.3. Proteção Anti-SSRF
- Esquemas permitidos: estritamente `http://` e `https://`.
- Bloqueio rígido de loopback (`127.0.0.0/8`, `::1`), redes privadas RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) e metadados de nuvem (`169.254.169.254`, `0.0.0.0`).

---

## 🗄️ 4. Padrão Canônico SQL Server 2022 & DbUp

- **Chaves Primárias:** `UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID()`.
- **Coluna de Tenant:** `TenantId UNIQUEIDENTIFIER NOT NULL` com FK para `dbo.Tenants(Id) ON DELETE CASCADE`.
- **Datas e Timestamps:** `DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()`.
- **Campos Criptografados (BYOK):** `VARBINARY(MAX)` para chaves AES-256 GCM, acompanhadas de `InitializationVector VARBINARY(16)` e `AuthTag VARBINARY(16)`.
- **Índices de Cobertura:** Uso obrigatório de cláusula `INCLUDE` para eliminar Key Lookups em consultas de alta frequência.

---

## 📡 5. Mensageria MassTransit & RabbitMQ

- **Serialização:** Configuração obrigatória com `cfg.UseRawJsonSerializer()` para garantir interoperabilidade total com o Python.
- **Topologia:**
  - `queue:ecommerce` / `queue:demo_ecommerce`: Entrada de extração de produtos.
  - `ecommerce_processed_queue`: Retorno assíncrono consumido por `ProcessedProductConsumer` para persistência Dapper e disparo de SSE no Redis.
  - `email_notifications`: Disparos transacionais via Resend.
  - `nuvemshop_bulk_sync`: Sincronização em lote de catálogo.

---

## 🎨 6. Frontend Canônico (EcommerceBot.Web)

- **Estrutura em 4 Camadas:** `Types -> Services -> Hooks -> UI Components`.
- **Comunicação:** Axios com envio automático de `X-Tenant-ID` via interceptors (`apiClient.ts`) e streaming SSE consumindo canais do Redis (`sseClient.ts`).
- **Acessibilidade & Mobile:** Alvos de toque com no mínimo 44px (`min-h-[44px]`), campos de formulário com tamanho de fonte >= 16px (evita zoom no iOS) e contraste WCAG 2.1 AA.

---

## 🚨 7. Verificação Runtime Obrigatória

Nenhuma tarefa é considerada concluída sem validação de compilação sem erros:
- **Backend Core:** `dotnet build EcommerceBot.Core\EcommerceBot.Core.sln`
- **Migrações:** `dotnet build Database.Migrations\Database.Migrations.csproj`
- **Frontend Web:** `npm run build` (em `EcommerceBot.Web`) 
- **Verificação de Segurança:**  `# Windows (Executar isolado no .venv do Worker) & "EcommerceBot.Worker\.venv\Scripts\semgrep.exe" scan --config auto --exclude="**/bin" --exclude="**/obj" --exclude="**/dist" --exclude="**/node_modules" --exclude="**/.venv" EcommerceBot.Core EcommerceBot.Web/src Database.Migrations`
