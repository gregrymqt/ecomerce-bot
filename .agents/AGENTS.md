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
7. **PROIBIDO execução arbitrária em ferramentas MCP:** Ferramentas expostas via Model Context Protocol DEVEM ser estritamente Read-Only e sanitizadas. É proibido executar T-SQL dinâmico (`EXEC`, `INSERT`, `UPDATE`, `DELETE`, `DROP`), comandos de escrita no Redis (`FLUSH`, `DEL`) ou comandos de shell arbitrários. Consultas a banco devem usar exclusivamente DMVs (`sys.dm_*`) com `WITH (NOLOCK)`.
8. **PROIBIDO NotebookLM no caminho crítico de produção:** O Google NotebookLM destina-se exclusivamente ao plano de pesquisa, auditoria de métricas e estudo offline. É proibido depender de chamadas síncronas ao NotebookLM para servir requisições de clientes no SaaS.

---

## 🏛️ 1. Hierarquia Cognitiva & Roteador de Skills (Sob Demanda)

Para evitar alucinações e perda de atenção (*Lost in the Middle*), opere estritamente sob a seguinte ordem de precedência:

```text
┌──────────────────────────────────────────────────────────────┐
│  NÍVEL 0: PROMPT ATUAL DO ENGENHEIRO (Tarefa Imediata)       │
├──────────────────────────────────────────────────────────────┤
│  NÍVEL 1: AGENTS.md (Constituição Inviolável do Monorepo)    │
├──────────────────────────────────────────────────────────────┤
│  NÍVEL 2: SKILL ESPECÍFICA DO DOMÍNIO (Carregamento Único)   │
├──────────────────────────────────────────────────────────────┤
│  NÍVEL 3: GRAFO DE TOPOLOGIA (GRAPH_REPORT.md / graph.json)  │
└──────────────────────────────────────────────────────────────┘
```

### 🧰 Catálogo de Skills (Ativação Exclusiva por Escopo)

NUNCA carregue todas as skills simultaneamente. Inspecione e ative estritamente o arquivo correspondente ao domínio da tarefa:

| Domínio | Arquivo da Skill | Quando Inspecionar |
|---|---|---|
| **Persistência / SQL** | `.agents/skills/sqlserver-dba/SKILL.md` | Ao criar scripts DbUp, índices, views ou investigar queries Dapper. |
| **Segurança / Core** | `.agents/skills/production-security/SKILL.md` | Ao mexer em webhooks, HMAC, AES-256 BYOK, SSRF ou isolamento de tenant. |
| **Interface / Web** | `.agents/skills/impeccable/SKILL.md` | Ao desenvolver páginas React, Tailwind, formulários, A11y e SSE. |
| **Comandos / Terminal** | `.agents/skills/token-density/SKILL.md` | Padrão obrigatório para execuções concisas no terminal (RTK pattern). |
| **Integrações / Shopify** | `.agents/skills/shopify-expert/SKILL.md` | Ao implementar ou refatorar endpoints Shopify (GraphQL 2024+, OAuth 2.0, Webhooks HMAC). |

### 🧭 Navegação via Grafo (Zero Busca Cega)

- **Antes de planejar alterações entre múltiplos arquivos:** Consulte `.agents/GRAPH_REPORT.md` para identificar Controllers, Filas e Tabelas envolvidas sem fazer varredura em massa.
- **Para checar dependências diretas de um símbolo:** Consulte `.agents/graph.json`.

---

## 📐 2. Visão Geral da Arquitetura

O **E-commerce Bot** é uma plataforma SaaS monorepo dividida em 4 pilares:

1. **Frontend Web SPA (`EcommerceBot.Web`):** React 18 + TypeScript + Vite + Tailwind CSS. Consome variáveis públicas estritamente através do módulo centralizado `@/config/env` (lendo o `.env` da raiz via `envDir`).
2. **Core API Central (`EcommerceBot.Core`):** ASP.NET Core Web API em .NET 8/9 (C#) em Clean Architecture / DDD, Dapper + T-SQL puro, pagamentos e orquestração. Carrega o `.env` nativamente via `builder.Configuration.AddDotEnvConfiguration()` e mapeia para classes fortemente tipadas de `Options`.
3. **AI/ML Engine (`EcommerceBot.Worker`):** Microsserviço Python assíncrono (FastAPI + Workers) para scraping, inferência LLM (OpenRouter) e modelos Scikit-Learn. Isolado de qualquer banco de dados, com resolução dinâmica do `.env` da raiz via `resolve_root_env_files()`.
4. **Database & Migrations (`Database.Migrations`):** Runner de migrações determinísticas em .NET com DbUp para Microsoft SQL Server 2022. Carrega a connection string automaticamente do `.env` via `DotEnvHelper.Load()`.

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
- **Super Administradores:** E-mails configurados em `Security:SuperAdminEmails` / `ADMIN_EMAILS` (ex: `admin@ecommercebot.com`) recebem privilégio `ADMIN` automaticamente no login/registro.

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
- **Hashes em Seeds / Migrações:** Hashes de senha temporários (seeds de Super Admin) DEVEM ser validados e gerados exclusivamente com BCrypt Work Factor 12 (`$2a$12$...`).

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
- **Configuração de Ambiente:** Consumo exclusivo via `@/config/env` (`env.apiUrl`, `env.mercadoPagoPublicKey`, etc.) com fallback padrão para `http://localhost:5183`.
- **Comunicação:** Axios com envio automático de `X-Tenant-ID` via interceptors (`apiClient.ts`) e streaming SSE consumindo canais do Redis (`sseClient.ts`).
- **Acessibilidade & Mobile:** Alvos de toque com no mínimo 44px (`min-h-[44px]`), campos de formulário com tamanho de fonte >= 16px (evita zoom no iOS) e contraste WCAG 2.1 AA.
- **Prevenção de Degradação por Injeção (Quality Gate):** Limite estrito de no máximo 350 linhas de código por arquivo enforced via ESLint (`max-lines: error` com `skipBlankLines: true, skipComments: true`). Proibido acumular código dentro de arquivos além desse teto. Componentes e módulos que crescerem devem ser decompostos por suas costuras naturais (subcomponentes dedicados, hooks especializados e serviços). Proibido usar `/* eslint-disable max-lines */`.

---

## 🚨 7. Verificação Runtime Obrigatória

Nenhuma tarefa é considerada concluída sem validação de compilação sem erros:
- **Backend Core:** `dotnet build EcommerceBot.Core\EcommerceBot.Core.sln`
- **Migrações:** `dotnet build Database.Migrations\Database.Migrations.csproj`
- **Frontend Web:** `npm run build` (em `EcommerceBot.Web`) 
- **Grafo de Topologia:** `& "EcommerceBot.Worker\.venv\Scripts\python.exe" .agents\scripts\generate_knowledge_graph.py`
- **Knowledge Pack (NotebookLM):** `& "EcommerceBot.Worker\.venv\Scripts\python.exe" .agents\scripts\generate_notebooklm_pack.py`
- **Verificação de Segurança:**  `# Windows (Executar isolado no .venv do Worker) & "EcommerceBot.Worker\.venv\Scripts\semgrep.exe" scan --config auto --exclude="**/bin" --exclude="**/obj" --exclude="**/dist" --exclude="**/node_modules" --exclude="**/.venv" EcommerceBot.Core EcommerceBot.Web/src Database.Migrations`

---

## 📡 8. Servidores MCP de Diagnóstico & Observabilidade

Quando agentes de IA necessitarem de introspecção sobre o ecossistema em desenvolvimento/staging:

1. **Transporte Padrão:** Utilizar comunicação local via `stdio` (Standard I/O), evitando abertura desnecessária de portas de rede na máquina do desenvolvedor.
2. **Reaproveitamento de Camada:** Implementar em C# (.NET) como aplicação console compartilhando as dependências de infraestrutura (`EcommerceBot.Infrastructure`), consumindo configurações tipadas existentes.
3. **Logs Estruturados:** A leitura de erros de aplicação deve ser realizada a partir de arquivos rotativos em disco gerados pelo Serilog (`logs/errors-.json`), sem travar o processo principal da API.
4. **Sanitização de Segredos:** O servidor MCP NUNCA deve expor senhas de banco de dados, chaves de API do Mercado Pago/Resend ou tokens JWT nas respostas entregues às LLMs.
5. **Runbooks Operacionais:** Guias de troubleshooting e arquitetura devem residir em `docs/runbooks/*.md` e ser expostos dinamicamente como **MCP Resources** (`resource://runbooks/{topico}`).

---

## 🔬 9. Arquitetura Tripartite de Machine Learning

O pipeline analítico e preditivo do E-commerce Bot é distribuído em três planos independentes:

1. **Batch & Data Plane (Google Spark / PySpark):**
   - Execução em lote para grandes volumes de dados históricos (transações, catálogo, eventos).
   - Treinamento e calibração de modelos (`RFMSegmentation`, `ChurnPredictor`, `LTVForecaster`).
   - Exportação determinística de artefatos serializados (`.joblib` ou `.onnx`).

2. **Runtime Inference Plane (EcommerceBot.Worker):**
   - Microsserviço assíncrono em Python (FastAPI + aio-pika).
   - Carrega modelos exportados em memória para inferência ultra-rápida (< 50ms).
   - Comunicação estrita via RabbitMQ (`queue:analytics_ml` -> `queue:analytics_processed`).
   - Zero acesso direto a bancos de dados relacionais.

3. **Knowledge & Research Plane (Google NotebookLM):**
   - Ambiente de estudo, síntese e aprendizado humano e de agentes (Card 83).
   - Alimentado com o **Master Knowledge Pack** consolidado (`docs/notebooklm/ecosystem_knowledge_pack.md`), relatórios de drift, métricas de acurácia e runbooks operacionais.
   - Zero acoplamento com a latência ou disponibilidade da produção.

