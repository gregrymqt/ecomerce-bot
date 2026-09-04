# 🗺️ E-commerce Bot — Topologia do Ecossistema (Knowledge Graph Summary)

> **Fonte Determinística de Navegação:** Consulte este sumário ou `.agents/graph.json` antes de planejar refatorações.

## 🏛️ 1. Pilares e Módulos Centrais
- **Backend Core:** ASP.NET Core (.NET 8/9), Dapper, SQL Server 2022, MassTransit.
- **MCP Diagnostics:** C# .NET 9 Console (`EcommerceBot.Diagnostics.Mcp`) via `stdio` (JSON-RPC 2.0).
- **AI & ML Engine:** Python 3.13 (FastAPI + aio-pika + Scrapling + Scikit-Learn + PySpark), 100% isolado de banco.
- **Frontend:** React 18 + Vite + Tailwind CSS em arquitetura orientada a features.
- **Database:** SQL Server 2022 com migrações versionadas via DbUp.

## 📡 2. Topologia de Filas RabbitMQ & Interoperabilidade
- `Fila:` **`analytics_ml_queue`**
- `Fila:` **`analytics_processed_queue`**
- `Fila:` **`consume_ml_queue`**
- `Fila:` **`ecommerce_processed_queue`**
- `Fila:` **`email_notifications`**
- `Fila:` **`llm_usage_queue`**
- `Fila:` **`nuvemshop_bulk_sync`**
- `Fila:` **`queue:ecommerce`**

## 🗄️ 3. Tabelas Mapeadas no Banco de Dados (DbUp)
- **Total de Tabelas Detectadas:** 20
- **Tabelas Core:** Tenants, Users, TenantAiCredentials, Products, Plans, Subscriptions, Orders, TrafficAttributions, EnterpriseLeads, LLMUsageLogs, OrderItems, EmailLogs...

## ⚡ 4. Controllers e Rotas da API Core
- **AdminAiCapacityController** (`/api/v1/admin/ai-capacity`): 3 endpoints mapeados.
- **AdminEnterpriseLeadsController** (`/api/v1/admin/enterprise-leads`): 3 endpoints mapeados.
- **AdminGrowthController** (`/api/v1/admin`): 5 endpoints mapeados.
- **AiCreditsWebhookPayload** (`/api/v1/webhooks/ai-credits`): 1 endpoints mapeados.
- **AnalyticsController** (`/api/v1/[controller]`): 2 endpoints mapeados.
- **AuthController** (`/api/v1/[controller]`): 8 endpoints mapeados.
- **CheckoutController** (`/api/v1/[controller]`): 5 endpoints mapeados.
- **EmailWebhookController** (`/api/v1/emails/webhooks`): 1 endpoints mapeados.
- **IntegrationsController** (`/api/v1/integrations`): 4 endpoints mapeados.
- **MercadoPagoWebhookController** (`/api/v1/webhooks/mercadopago`): 1 endpoints mapeados.
- *... e mais 13 controllers catalogados no graph.json.*

## 🎨 5. Módulos Frontend (`EcommerceBot.Web`)
- **admin**: [components, hooks, pages, services, types]
- **analytics**: [components, hooks, pages, services, types]
- **auth**: [components, context, hooks, pages, services, types]
- **catalog**: [components, hooks, pages, services, types]
- **checkout**: [components, hooks, pages, services, types]
- **dashboard**: [components, hooks, pages, services, types]
- **home**: [components, hooks, pages, services, types]
- **integrations**: [components, hooks, pages, services, types]
- **live-demo**: [components, constants, hooks, pages, services, types]
- **metering**: [components, hooks, pages, services, types, __tests__]
- **plans**: [components, hooks, pages, services, types]
- **scraper**: [components, hooks, services, types]
- **settings**: [components, hooks, pages, services, types]
- **wallet**: [components, hooks, pages, services, types]

## 🛠️ 6. Servidor MCP de Diagnóstico (`EcommerceBot.Diagnostics.Mcp`)
- **Transporte:** `stdio` (JSON-RPC 2.0 padrão v2024-11-05)
- **Ferramentas Registradas:**
  - **`get_recent_application_errors`** (`ErrorLogReaderTool`): Lê as últimas falhas (Warning, Error, Fatal) registradas pelo Serilog nos arquivos rotativos JSON da API Core sem bloquear a aplicação.
  - **`inspect_ml_artifacts`** (`MlModelArtifactsTool`): Inspeciona os artefatos de Machine Learning (.joblib) e o manifesto de metadados gerados pelo Google Spark / PySpark no ecossistema.
  - **`inspect_rabbitmq_queues`** (`RabbitMqQueueTool`): Inspeciona o backlog de mensagens, consumidores ativos e taxas nas filas críticas e DLQs do RabbitMQ.
  - **`check_redis_metrics`** (`RedisMetricsTool`): Inspeciona o estado do Redis: conectividade, latência de ping, uso de memória, número de clientes conectados e status de cluster/standalone.
  - **`check_spark_pipeline_status`** (`SparkPipelineStatusTool`): Inspeciona o status e histórico de execuções do pipeline Google Spark Batch, verificando relatórios de métricas do NotebookLM e periodicidade.
  - **`check_sql_health`** (`SqlHealthTool`): Inspeciona a saúde do SQL Server 2022 via DMVs (sys.dm_*): bloqueios ativos, deadlocks em andamento, conexões e top queries lentas.

## 🔬 7. Modelos de Machine Learning & Spark (`EcommerceBot.Worker/app/ml`)
- **`ChurnPredictor`** (MachineLearningModel)
- **`LTVForecaster`** (MachineLearningModel)
- **`AnalyticsMLEngine`** (MachineLearningModel)
- **`RFMSegmentation`** (MachineLearningModel)
- **`TokenCapacityForecaster`** (MachineLearningModel)
- **`SparkBatchPipeline`** (SparkBatchPipeline)

## 📚 8. Runbooks Operacionais Catalogados (`docs/runbooks`)
- **`resource://runbooks/ml-spark-notebooklm`**: 🔬 Runbook: Pipeline Tripartite de ML (Google Spark + Python Worker + NotebookLM)
- **`resource://runbooks/rabbitmq-troubleshooting`**: 🐇 Runbook: Diagnóstico e Troubleshooting de RabbitMQ & Filas
- **`resource://runbooks/sql-server-diagnostics`**: 🗄️ Runbook: Diagnóstico de SQL Server 2022 via DMVs

## 🧭 9. Diretriz de Uso para Agentes
1. Para verificar o raio de impacto de um campo ou contrato, localize o símbolo no `.agents/graph.json`.
2. NUNCA altere assinaturas de mensageria sem verificar consumidores em C# e handlers Python simultaneamente.
3. Mantenha queries em conformidade com as tabelas listadas na Seção 3 e isole queries por `TenantId`.
4. Utilize as ferramentas do Servidor MCP (Seção 6) para inspeção operacional antes de qualquer alteração de infraestrutura.