# 🤖 E-commerce Bot — Guia de Arquitetura & Instruções para Agentes de IA

Este documento descreve a arquitetura, pilha de tecnologias, convenções de código, regras de segurança, fluxos de dados e diretrizes de desenvolvimento do ecossistema **E-commerce Bot**. 

> **AVISO PARA IAs:** Este arquivo é a fonte da verdade para entender o projeto. Sempre consulte e siga rigorosamente estas regras ao criar, modificar ou refatorar código neste repositório.

---

## 📐 1. Visão Geral da Arquitetura

O **E-commerce Bot** é uma plataforma monorepo escalável dividida em 3 partes principais:
1. **Frontend:** SPA em React + Vite.
2. **Core API:** Aplicação Central em .NET 8 (C#) responsável pelas regras de negócio, multi-tenancy, pagamentos e persistência.
3. **AI/ML Engine:** Worker em Python focado estritamente em inferência de LLMs (OpenRouter), Scraping inteligente e Machine Learning preditivo.

```text
                               ┌────────────────────────────────────────┐
                               │   ecom-autobot-web (React + Vite)     │
                               └──────────────────┬─────────────────────┘
                                                  │ HTTP / SSE (/api/v1, X-Tenant-ID, JWT)
                                                  ▼
                               ┌────────────────────────────────────────┐
                               │    EcommerceBot.Core (API .NET 8)      │
                               │  • Auth JWT & Multi-Tenancy            │
                               │  • Dapper + SQL Server 2022            │
                               │  • Mercado Pago (PIX / CC / Preapproval│
                               │  • Shopify (GraphQL) & Nuvemshop (REST)│
                               │  • MassTransit Producer/Consumer       │
                               │  • Redis Cache, RateLimit & SSE Stream │
                               └───────┬────────────────────────┬───────┘
                                       │                        │
                     ecommerce_raw_queue (RabbitMQ)             │ analytics_ml_queue
                                       │                        │
                                       ▼                        ▼
                               ┌────────────────────────────────────────┐
                               │  ecom-autobot-api (Python AI/ML Engine)│
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
│   ├── AGENTS.md               # Instruções e diretrizes universais para IAs (Fonte da Verdade)
│   └── skills/                 # Skills customizadas (sqlserver-dba, production-security, etc.)
├── Database.Migrations/        # 🔷 Projeto .NET 8 com DbUp para SQL Server 2022
│   ├── Database.Migrations.csproj # Runner de migrações determinísticas
│   ├── Program.cs              # Execução CLI/Startup com transações por script
│   └── Scripts/                # DDL T-SQL idempotente (001 a 005)
├── EcommerceBot.Core/          # ⚡ API Central em .NET 8 (C#) - Clean Architecture
│   ├── EcommerceBot.Core.sln
│   └── src/
│       ├── EcommerceBot.Domain/         # Entidades, Enums e Interfaces
│       ├── EcommerceBot.Application/    # Casos de Uso, DTOs, FluentValidation
│       ├── EcommerceBot.Infrastructure/ # Dapper, MassTransit, Redis, Gateways
│       └── EcommerceBot.Api/            # ASP.NET Core Web API (Controllers, Middlewares)
├── infra/                      # 🛠️ Infraestrutura e Deploy Dev/Prod
│   ├── dev/                    # docker-compose.dev.yml, .env.dev.example (MSSQL, Redis, RabbitMQ)
│   └── prod/                   # docker-compose.prod.yml, scripts de manutenção e backups (Cloudflare R2)
├── .gitignore                  # Regras estritas de exclusão (bin/obj, .venv, node_modules, *.bak)
├── ecom-autobot-api/           # 🐍 Microsserviço Python (AI & ML Engine)
│   ├── app/
│   │   ├── main.py             # Entrypoint e inicializador dos Workers (RabbitMQ)
│   │   ├── ai/                 # OpenRouterLLMProvider, Tenacity Retries
│   │   ├── scraper/            # ScraperWorker, JsonLdParser, MarkdownParser
│   │   └── ml/                 # Modelos Scikit-Learn (RFM, Churn, LTV)
│   ├── Dockerfile
│   └── requirements.txt
└── ecom-autobot-web/           # 🔵 Frontend Web SPA (React 18 + TypeScript + Vite + Tailwind CSS)
    ├── src/
    │   ├── components/ui/      # Atomic Design System
    │   ├── features/           # Módulos Funcionais DDD
    │   ├── layouts/            # MainLayout responsivo
    │   └── lib/                # apiClient (Axios com JWT/X-Tenant-ID) e sseClient
    ├── package.json
    └── vite.config.ts
```

---

## ⚙️ 3. Regras de Arquitetura Backend (.NET 8 & Python)

### ⚡ EcommerceBot.Core (.NET 8 / C#)
- **Framework:** ASP.NET Core Web API (.NET 8).
- **Arquitetura:** Clean Architecture (Domain, Application, Infrastructure, Api) baseada em DDD.
- **Acesso a Dados:** **Dapper** com `Microsoft.Data.SqlClient` chamando rotinas T-SQL e Views criadas pelo `Database.Migrations` (DbUp).
- **Mensageria:** **MassTransit** (`MassTransit.RabbitMQ`) para publicação e consumo nas filas `ecommerce_raw_queue`, `ecommerce_processed_queue` e `analytics_ml_queue`.
- **Criptografia e Multi-Tenancy:** 
  - Todo request passa pelo `TenantHeaderMiddleware` requerendo `X-Tenant-ID`.
  - Consultas Dapper obrigatoriamente incluem filtro por `TenantId`.
  - Criptografia BYOK com `System.Security.Cryptography.AesGcm` (AES-256 GCM) no banco.

### 🐍 ecom-autobot-api (Python AI/ML Engine)
- **Framework:** Python 3.10+ (FastAPI simplificado rodando `uvicorn` e Lifespan workers).
- **Responsabilidades:** Apenas Inferência LLM, Scraping e Machine Learning. **Sem acesso ao Banco de Dados** — o estado é mantido pelo C# através do RabbitMQ.
- **Módulos ML:** Uso de `scikit-learn`, `pandas`, e `numpy` para clusterização RFM, análise de Churn e projeção LTV.

---

### 🗄️ 4. Padrão Canônico SQL Server 2022 & DbUp (.NET 8)

Consulte a skill [`sqlserver-dba`](file:///c:/Users/digob/Desktop/ecommerce-bot/.agents/skills/sqlserver-dba/SKILL.md):
1. **Versionamento com DbUp:** Todos os scripts residem em `Database.Migrations/Scripts/` (`NNN_Nome_Do_Script.sql`). Scripts DDL DEVEM ser idempotentes (`IF NOT EXISTS...`).
2. **Isolamento Multi-Tenant:** Coluna `TenantId UNIQUEIDENTIFIER NOT NULL` nas tabelas transacionais. IDs primários usam `NEWSEQUENTIALID()`.
3. **Índices:** Uso estrito de índices compostos e de cobertura (ex: `Orders (TenantId, CreatedAt DESC) INCLUDE (...)`).
4. **Agent & Ola Hallengren:** Limite de 2560 MB no SQL Server. Manutenção ativa via jobs do Ola Hallengren e DMVs customizadas (`vw_Monitor_TopQueries`).

---

### ☁️ 5. Política de Backups & Resiliência (Cloudflare R2)

1. **Rotina Diária:** Script `backup_sqlserver_r2.sh` rodando via cron.
2. **Backup Nativo SQL Server:** `WITH COMPRESSION, CHECKSUM, INIT` dos bancos `EcommerceBotDb`, `master`, `msdb`.
3. **Sincronização Cloudflare R2:** Upload via `rclone` (com fallback AWS CLI/Boto3) + Alertas Discord.
4. **Housekeeping:** Remoção local em 2 dias (`find ... -mtime +2 -delete`).

---

### 🎨 6. Regras de Arquitetura Frontend (`ecom-autobot-web`)

- **Contratos da API:** O Frontend aponta para `/api/v1/...` no backend C#, que mantém total paridade com os endpoints originais para evitar breaking changes.
- **Padrão em 4 Camadas:** `Types -> Services -> Hooks -> UI Components`.
- **Mobile-First:** Touch Targets com altura mínima de 44px (`min-h-[44px]`). Sem Auto-Zoom no iOS (`font-size >= 16px`).
- **Clients:** `apiClient.ts` (Axios com interceptors JWT/Tenant) e `sseClient.ts` (EventSource para SSE).

---

### 🚨 7. Diretrizes Fundamentais para Agentes de IA

1. **Modularidade (Anti-Monólito):** Mantenha arquivos menores que 300 linhas aplicando Single Responsibility Principle (SRP).
2. **Código Assíncrono:** No .NET, use `Task`, `async/await` e `IDbConnection.QueryAsync`. No Python, use `async def`, `httpx.AsyncClient` e `aio-pika`.
3. **Densidade de Sinal:** Elimine preâmbulos vazios e formate respostas curtas.
4. **Análise de Raio de Impacto:** Valide a cadeia inteira de dados (`UI Component -> Hook -> .NET API Controller -> .NET MediatR/Service -> Dapper Repo -> SQL Server` + `RabbitMQ -> Python Worker`) antes de quebrar contratos.
5. **Verificação Runtime:** NUNCA considere uma tarefa concluída sem testar a compilação (`dotnet build`, `npm run build`).
