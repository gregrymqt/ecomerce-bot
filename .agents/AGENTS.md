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
9. **PROIBIDO HTML inline / hardcoded para e-mails:** NUNCA concatene ou declare strings HTML diretamente no código C# ou Python para envio de e-mails. No Python (`EcommerceBot.Worker`), templates DEVEM ser criados exclusivamente como arquivos `.html` na pasta `EcommerceBot.Worker/app/templates` e renderizados via Jinja2 (`render_jinja_template`). No C# (`EcommerceBot.Core`), templates DEVEM ser criados exclusivamente como views Razor `.cshtml` na pasta `EcommerceBot.Core/src/EcommerceBot.Api/Views/Emails` acompanhados de sua ViewModel fortemente tipada em `EcommerceBot.Core/src/EcommerceBot.Application/ViewModels/Emails` e renderizados via `IRazorTemplateRenderer`.
10. **PROIBIDO lógica de serviço ou configuração inline no Program.cs:** O arquivo `Program.cs` destina-se estritamente à orquestração do pipeline de inicialização (*bootstrapping*). É terminantemente proibido declarar lambdas extensas, configurações de options, registros diretos de serviços ou lógica de middlewares/infraestrutura dentro de `Program.cs`. Todo setup DEVE ser encapsulado em métodos de extensão dedicados (`*Extensions.cs`) com nomenclatura semântica clara (ex: `builder.ConfigureSerilog()`, `services.AddInfrastructure()`, `services.AddApiServices()`, `app.UseCustomRequestLogging()`).
11. **PROIBIDO acoplamento direto Component/Page -> Service no Frontend:** No `EcommerceBot.Web`, componentes de UI (`components/`) e páginas (`pages/`) NUNCA devem importar diretamente arquivos de `services/` ou executar chamadas de rede/API (`apiClient`, `fetch`, `axios`). Toda comunicação com a camada de serviços DEVE ser mediada e encapsulada exclusivamente por custom hooks em `hooks/`.
12. **PROIBIDO alterar o backend transacional sem consultar a skill de C# (.NET):** Toda criação, modificação ou refatoração de código na pasta `EcommerceBot.Core` DEVE obrigatoriamente inspecionar e seguir as diretrizes da skill `.agents/skills/c#-best-pratices/SKILL.md` para garantir conformidade estrita com os padrões de arquitetura, injeção de dependências, resiliência, performance e observabilidade.
13. **PROIBIDO alterar o backend worker sem consultar a skill de Python:** Toda criação, modificação ou refatoração de código na pasta `EcommerceBot.Worker` DEVE obrigatoriamente inspecionar e seguir as diretrizes da skill `.agents/skills/python-best-pratices/SKILL.md` para garantir conformidade estrita com os padrões de arquitetura assíncrona, tipagem estrita, ausência total de dependências de banco relacional, mensageria (RabbitMQ/aio-pika), cache/locks (Redis), templates Jinja2 e observabilidade.

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
| **Interface / Web** | `.agents/skills/impeccable/SKILL.md` | **MANDATÓRIO:** Sempre que for criar, modificar ou refatorar qualquer arquivo do frontend (`EcommerceBot.Web`), incluindo páginas React, componentes, hooks, estilização Tailwind, formulários, A11y e SSE. |
| **Comandos / Terminal** | `.agents/skills/token-density/SKILL.md` | Padrão obrigatório para execuções concisas no terminal (RTK pattern). |
| **Integrações / Shopify** | `.agents/skills/shopify-expert/SKILL.md` | Ao implementar ou refatorar endpoints Shopify (GraphQL 2024+, OAuth 2.0, Webhooks HMAC). |
| **Pagamentos / Mercado Pago** | `.agents/skills/mercadopago-expert/SKILL.md` | Ao mexer em checkout transparente (PIX/Cartão), recargas de créditos IA (Ledger), conciliação e webhooks Mercado Pago. |
| **Backend Transacional / C#** | `.agents/skills/c#-best-pratices/SKILL.md` | **MANDATÓRIO:** Sempre que for criar, modificar ou refatorar qualquer arquivo do backend transacional (`EcommerceBot.Core`), incluindo controllers, application, domain, infrastructure e middlewares. |
| **Backend Worker / Python** | `.agents/skills/python-best-pratices/SKILL.md` | **MANDATÓRIO:** Sempre que for criar, modificar ou refatorar qualquer arquivo do backend worker (`EcommerceBot.Worker`), incluindo workers assíncronos, rotas FastAPI, scraping, inferência ML, mensageria RabbitMQ e Jinja2 templates. |
| **Integrações / Nuvemshop** | `.agents/skills/nuvemshop-expert/SKILL.md` | Ao implementar ou refatorar conexões Nuvemshop (OAuth 2.0, BYOK AES-256, REST V1, Webhooks Thin e Bulk Sync RabbitMQ). |

### 🧭 Navegação via Grafo (Zero Busca Cega)

- **Antes de planejar alterações entre múltiplos arquivos:** Consulte `.agents/GRAPH_REPORT.md` para identificar Controllers, Filas e Tabelas envolvidas sem fazer varredura em massa.
- **Para checar dependências diretas de um símbolo:** Consulte `.agents/graph.json`.

---

## 📐 2. Visão Geral da Arquitetura

O **E-commerce Bot** é uma plataforma SaaS monorepo dividida em 4 pilares:

1. **Frontend Web SPA (`EcommerceBot.Web`):** React 18 + TypeScript + Vite + Tailwind CSS. Consome variáveis públicas estritamente através do módulo centralizado `@/config/env` (lendo o `.env` da raiz via `envDir`).
2. **Core API Central (`EcommerceBot.Core`):** ASP.NET Core Web API em .NET 8/9 (C#) em Clean Architecture / DDD, Dapper + T-SQL puro, pagamentos e orquestração. Carrega o `.env` nativamente via `builder.Configuration.AddDotEnvConfiguration()` e mapeia para classes fortemente tipadas de `Options`. O arquivo `Program.cs` opera sob o **Clean Bootstrapping Pattern**: atua puramente como orquestrador de alto nível, delegando toda configuração de serviços, middlewares e observabilidade para métodos de extensão dedicados em `Configurations/` e `Middlewares/`.
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
                               │  • Mercado Pago (PIX / CC / Ledger)    │
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
- **Especificações Canônicas por Provedor:**
  - **Mercado Pago** (`x-signature`, manifesto `ts`/`v1`, conciliação e pacotes de crédito): consulte estritamente `.agents/skills/mercadopago-expert/SKILL.md`.
  - **Nuvemshop** (`X-LinkedStore-HMAC-SHA256`, Thin Payload, OAuth 2.0 e Bulk Sync): consulte estritamente `.agents/skills/nuvemshop-expert/SKILL.md`.
  - **Shopify** (`X-Shopify-Hmac-Sha256`, GraphQL 2024+ e Bulk API): consulte estritamente `.agents/skills/shopify-expert/SKILL.md`.

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
  - `payments_process_queue`: Conciliação assíncrona de pagamentos Mercado Pago e concessão de benefícios SaaS.
  - `nuvemshop_bulk_sync`: Sincronização em lote de catálogo com a Nuvemshop.

### 5.1. Padrão Canônico de E-mails e Templates (C# Razor & Python Jinja2)
Para garantir sanitização XSS, separação absoluta de responsabilidades, preview visual e manutenibilidade, o ecossistema proíbe HTML inline e impõe:

| Stack / Microsserviço | Localização do Template | Localização do Modelo de Dados | Mecanismo de Renderização |
|---|---|---|---|
| **C# Core API (`EcommerceBot.Core`)** | `EcommerceBot.Core/src/EcommerceBot.Api/Views/Emails/{Nome}.cshtml` | `EcommerceBot.Core/src/EcommerceBot.Application/ViewModels/Emails/{Nome}EmailViewModel.cs` | `IRazorTemplateRenderer.RenderViewToStringAsync("/Views/Emails/{Nome}.cshtml", model)` |
| **Python Worker (`EcommerceBot.Worker`)** | `EcommerceBot.Worker/app/templates/{nome}.html` | Dicionário tipado / Schema Pydantic | `render_jinja_template("{nome}.html", context)` via `jinja2.Environment(autoescape=True)` |

- **No C# (.NET):** Todo novo tipo de e-mail consumido por `EmailNotificationConsumer` (ou gerado na Core API) DEVE instanciar uma ViewModel dedicada em `EcommerceBot.Application.ViewModels.Emails` e renderizar sua view `.cshtml` correspondente via `IRazorTemplateRenderer`. É proibido concatenar strings HTML em C#.
- **No Python:** Todo e-mail ou documento HTML gerado pelo Worker DEVE residir em `EcommerceBot.Worker/app/templates` e ser renderizado exclusivamente via `render_jinja_template`, com `autoescape` ativo contra injeção de HTML/XSS. É proibido usar f-strings com tags HTML em código Python.

---

## 🎨 6. Frontend Canônico (EcommerceBot.Web)

- **Estrutura em 4 Camadas (Isolamento Estrito):** `Types -> Services -> Hooks -> UI Components / Pages`. Componentes visuais (`components/`) e páginas (`pages/`) são estritamente declarativos e NUNCA importam de `services/` nem acionam `apiClient` diretamente. Toda comunicação com a camada de serviços, ciclo assíncrono e tratamento de erro de rede DEVE ser encapsulada em custom hooks (`hooks/`).
- **Governança da Skill Impeccable:** Qualquer alteração no frontend exige a inspeção prévia de `.agents/skills/impeccable/SKILL.md` e a observância rigorosa do seu checklist pré-flight de separação de responsabilidades.
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

4. **MLOps & Governança de Artefatos (Cloudflare R2 / VPS):**
   - **PROIBIDO versionar binários de modelos no Git:** Pesos serializados (`.joblib`, `.onnx`, `.pkl`) são gerenciados via Cloudflare R2 (S3 API). O Git rastreia apenas código, manifestos JSON de metadados e relatórios analíticos Markdown.
   - **Armazenamento no R2:** Estrutura dupla com histórico versionado (`ml-artifacts/rfm/${TIMESTAMP}/`) e ponteiro estável (`ml-artifacts/rfm/latest/`).
   - **Sincronização na VPS:** Script resiliente (`infra/prod/scripts/sync_ml_artifacts_r2.sh`) abastecendo o volume persistente `worker-prod-artifacts`.
   - **Hot-Reload:** O Worker Python recarrega os pesos dinamicamente em memória baseado em `mtime`, com zero downtime e sem reiniciar o container.


