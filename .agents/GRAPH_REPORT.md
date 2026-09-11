# 🗺️ E-commerce Bot — Topologia do Ecossistema (Knowledge Graph Summary)

> **Fonte Canônica Determinística:** Consulte este sumário executivo antes de planejar refatorações. Detalhes exaustivos de nós e arestas residem em `.agents/graph.json`.

## 🏛️ 1. Pilares da Arquitetura & Stack Tecnológica
- **Frontend SPA (`EcommerceBot.Web`):** React 18 + Vite + Tailwind CSS em arquitetura orientada a features em 4 camadas (`Types -> Services -> Hooks -> Components`).
- **Backend Core (`EcommerceBot.Core`):** ASP.NET Core (.NET 9), Clean Architecture / DDD, Dapper + SQL Server 2022, MassTransit Raw JSON.
- **AI/ML Engine (`EcommerceBot.Worker`):** Python 3.13 (FastAPI + aio-pika + Scrapling + OpenRouter + Scikit-Learn + PySpark), 100% isolado de banco relacional.
- **Database (`Database.Migrations`):** SQL Server 2022 com DbUp determinístico, RCSI ativo, Row-Level Security (RLS) e backups contínuos R2.
- **Observabilidade & SRE (`EcommerceBot.Diagnostics.Mcp` & `infra/`):** Servidor MCP via `stdio` (JSON-RPC 2.0), Docker Compose e automações Linux.

## 🔄 2. Matriz de Fluxos Críticos de Ponta a Ponta
| Fluxo de Negócio | Ponto de Início (Frontend/Hook) | Ponto de Entrada (Core API) | Mensageria (RabbitMQ / Redis) | Processamento (Worker / Consumer) | Persistência / Saída |
|---|---|---|---|---|---|
| **Scraping Demo (Live)** | `LiveDemoPage` / `useLiveDemoSSE` | `POST /api/v1/demo/extract` | `queue:demo_ecommerce` (DLX) | `ScraperWorker` + OpenRouter | `events:tenant:{id}` (SSE) |
| **Catálogo Multi-Tenant** | `CatalogPage` / `product.service` | `POST /api/v1/products/enrich` | `queue:ecommerce` | `ScraperWorker` + Scrapling | `dbo.Products` via Dapper |
| **Recarga / Ledger** | `WalletPage` / `wallet.service` | `POST /api/v1/wallet/recharge` | `queue:payments_process_queue` | `PaymentProcessingConsumer` | `dbo.CreditTransactions` |
| **Sync Nuvemshop** | `IntegrationsPage` / `integration.service` | `POST /api/v1/nuvemshop/sync` | `queue:nuvemshop_bulk_sync` | `NuvemshopBulkSyncConsumer` | `dbo.StoreIntegrations` |
| **Sync Shopify** | `IntegrationsPage` / `integration.service` | `POST /api/v1/shopify/sync` | `queue:shopify_bulk_sync` | `ShopifyBulkSyncConsumer` | `dbo.StoreIntegrations` |
| **Analytics ML / Churn** | `TrafficAnalyticsPage` / `mlAnalytics.service`| `POST /api/v1/analytics/train` | `queue:analytics_ml_queue` | `MLWorker` (RFM / Churn / LTV) | `queue:analytics_processed` |

## 📡 3. Topologia de Mensageria EDA & Dead-Letter (RabbitMQ)
- **Dead-Letter Exchange (DLX):** `ecommerce_dlx` (Direct)
- **Dead-Letter Queue (DLQ):** `dlq_ecommerce` (TTL 7 dias)
- **Filas com Proteção DLX Ativa:** `demo_ecommerce` (Max-Priority 10, Max-Length 100), `ecommerce`, `analytics_ml_queue`.
- **Filas de Retorno & Operacionais:** `ecommerce_processed_queue`, `analytics_processed_queue`, `llm_usage_queue`, `payments_process_queue`, `email_notifications`, `shopify_bulk_sync`, `nuvemshop_bulk_sync`.
- **Barramento Real-Time:** Redis Pub/Sub com canal parametrizado `events:tenant:{tenantId}` consumido pelo cliente SSE.

## 🗄️ 4. Banco de Dados, Linhagem & Governança (SQL Server 2022)
- **Tabelas Monitoradas (22):** AiProviderCredits, AuditLogs, CreditTransactions, EmailLogs, EnterpriseLeads, LLMUsageLogs, OrderItems, Orders, Plans, Products, RobotActivities, Roles, SaasAdSpends, SaasTrafficVisits...
- **Views Diagnósticas (7):** vw_Monitor_ActiveSnapshotTransactions, vw_Monitor_Deadlocks, vw_Monitor_MissingIndexes, vw_Monitor_TableSizes, vw_Monitor_TopQueries, vw_Monitor_VersionStore, vw_Monitor_WaitStats.
- **Políticas RLS Ativas (1):** `TenantSecurityPolicy` protegendo isolamento por `SESSION_CONTEXT(TenantId)` com predicado `Security.fn_TenantAccessPredicate`.
- **Governança de Transações:** RCSI ativo (`READ_COMMITTED_SNAPSHOT ON`), Chaves Primárias `NEWSEQUENTIALID()`, clustered por `(TenantId, ...)`.

## ⚡ 5. Controllers da API Core & Gateways Externos
- **Controllers Mapeados (25):**
  - **`AdminAiCapacityController`** (`/api/v1/admin/ai-capacity`): 3 endpoints.
  - **`AdminEnterpriseLeadsController`** (`/api/v1/admin/enterprise-leads`): 3 endpoints.
  - **`AdminGrowthController`** (`/api/v1/admin`): 5 endpoints.
  - **`AiCreditsWebhookController`** (`/api/v1/webhooks/ai-credits`): 1 endpoints.
  - **`AnalyticsController`** (`/api/v1/[controller]`): 2 endpoints.
  - **`AuthController`** (`/api/v1/[controller]`): 10 endpoints.
  - **`BillingProfileController`** (`/api/v1/billing/profile`): 2 endpoints.
  - **`CheckoutController`** (`/api/v1/[controller]`): 3 endpoints.
  - **`ComplianceController`** (`/api/v1/compliance`): 2 endpoints.
  - **`EmailWebhookController`** (`/api/v1/emails/webhooks`): 1 endpoints.
  - *... e mais 15 controllers catalogados no graph.json.*
- **Gateways Externos Integrados:** `ShopifyGateway` (GraphQL 2024+), `NuvemshopGateway` (REST V1), `MercadoPagoGateway` (PIX/CC), `ResendGateway` (E-mails).

## 🔬 6. Engine de Inteligência Artificial & Machine Learning (Python Worker)
- **FastAPI Worker Service:** Endpoints `/health`, `/health/live` e `/health/ready` com sondagem ativa de RabbitMQ e Redis.
- **Scraper & Enriquecimento:** `ScraperWorker`, `ScraperAndLLMParser`, `ScraplingClient` com proteção Anti-SSRF e atalho nativo Shopify `.json`.
- **Roteador LLM:** `LLMEngineRouter` (OpenRouter API) com mascaramento de PII e blindagem anti-injeção (OWASP LLM01/02).
- **Modelos Preditivos:** RFMSegmentation, ChurnPredictor, LTVForecaster, TokenCapacityForecaster calibrados via `SparkBatchPipeline` (`rfm_pipeline.joblib`).

## 🎨 7. Frontend SPA (`EcommerceBot.Web`)
- **Páginas & Rotas (28):** Auth, ResetPassword, LiveDemo, Catalog, Dashboard, Wallet, Integrations, Metering, TrafficAnalytics, AdminLeads, AdminAiCapacity, AdminGrowth, AdminPlans.
- **Features (13):** admin, analytics, auth, catalog, dashboard, home, integrations, live-demo, metering, plans, scraper, settings, wallet.
- **Serviços & Hooks HTTP (67):** Conectados deterministicamente aos Controllers do backend via `calls_endpoint`.

## 🛠️ 8. Servidor MCP de Diagnóstico & Infraestrutura SRE
- **Servidor MCP:** `EcommerceBot.Diagnostics.Mcp` (`stdio`, JSON-RPC 2.0).
- **Ferramentas Registradas:**
  - **`check_sql_health`** (`CheckSqlHealthTool`)
  - **`check_redis_metrics`** (`CheckRedisMetricsTool`)
  - **`inspect_rabbitmq_queues`** (`InspectRabbitMqQueuesTool`)
  - **`get_recent_application_errors`** (`GetRecentApplicationErrorsTool`)
  - **`inspect_ml_artifacts`** (`InspectMlArtifactsTool`)
  - **`check_spark_pipeline_status`** (`CheckSparkPipelineStatusTool`)
- **Runbooks Catalogados (3):** Expostos via `resource://runbooks/{slug}`.
- **Containers Docker:** `mssql`, `redis`, `rabbitmq`, `api`, `worker`, `web`, `nginx`.
- **Automações SRE:** Backup Full diário R2 com `DBCC CHECKDB`, log truncation a cada 15 min, manutenção Ola Hallengren.

## 🧭 9. Regras de Navegação para Agentes de IA
1. **Zero Busca Cega:** Inspecione sempre `.agents/graph.json` para mapear dependências antes de alterar qualquer assinatura de método ou fila.
2. **Contratos EDA:** Qualquer alteração em mensagens requer validação conjunta nos produtores C# e consumidores Python.
3. **Multi-Tenancy:** Consultas SQL devem conter estritamente `WHERE TenantId = @TenantId` tipado.
4. **Limites Frontend:** Nenhum arquivo React pode ultrapassar 350 linhas de código (Quality Gate ESLint).