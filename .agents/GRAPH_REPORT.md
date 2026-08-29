# 🗺️ E-commerce Bot — Topologia do Ecossistema (Knowledge Graph Summary)

> **Fonte Determinística de Navegação:** Consulte este sumário ou `.agents/graph.json` antes de planejar refatorações.

## 🏛️ 1. Pilares e Módulos Centrais
- **Backend Core:** ASP.NET Core (.NET 8/9), Dapper, SQL Server 2022, MassTransit.
- **AI Worker:** Python 3.10+ (FastAPI + aio-pika + Scrapling), 100% isolado de banco.
- **Frontend:** React 18 + Vite + Tailwind CSS em arquitetura por features.
- **Database:** SQL Server 2022 com migrações versionadas via DbUp.

## 📡 2. Topologia de Filas RabbitMQ & Interoperabilidade
- `Filas:` **`analytics_ml_queue`**
- `Filas:` **`analytics_processed_queue`**
- `Filas:` **`consume_ml_queue`**
- `Filas:` **`ecommerce_processed_queue`**
- `Filas:` **`email_notifications`**
- `Filas:` **`llm_usage_queue`**
- `Filas:` **`nuvemshop_bulk_sync`**
- `Filas:` **`queue:ecommerce`**

## 🗄️ 3. Tabelas Mapeadas no Banco de Dados (DbUp)
- **Total de Tabelas Detectadas:** 19
- **Tabelas Core:** Tenants, Users, TenantAiCredentials, Products, Plans, Subscriptions, Orders, TrafficAttributions, EnterpriseLeads, LLMUsageLogs, OrderItems, EmailLogs...

## ⚡ 4. Controllers e Rotas da API Core
- **AdminEnterpriseLeadsController** (`/api/v1/admin/enterprise-leads`): 3 endpoints mapeados.
- **AdminGrowthController** (`/api/v1/admin`): 5 endpoints mapeados.
- **AnalyticsController** (`/api/v1/[controller]`): 2 endpoints mapeados.
- **AuthController** (`/api/v1/[controller]`): 8 endpoints mapeados.
- **CheckoutController** (`/api/v1/[controller]`): 5 endpoints mapeados.
- **EmailWebhookController** (`/api/v1/emails/webhooks`): 1 endpoints mapeados.
- **IntegrationsController** (`/api/v1/integrations`): 4 endpoints mapeados.
- **MercadoPagoWebhookController** (`/api/v1/webhooks/mercadopago`): 1 endpoints mapeados.
- **MeteringController** (`/api/v1/[controller]`): 5 endpoints mapeados.
- **NuvemshopIntegrationController** (`/api/v1/nuvemshop`): 8 endpoints mapeados.
- *... e mais 11 controllers catalogados no graph.json.*

## 🎨 5. Módulos Frontend (`EcommerceBot.Web`)
- **admin**: [components, hooks, pages, services, types]
- **analytics**: [components, hooks, pages, services, types]
- **auth**: [components, context, hooks, pages, services, types]
- **catalog**: [components, hooks, pages, services, types]
- **checkout**: [components, hooks, pages, services, types]
- **dashboard**: [components, hooks, pages, services, types]
- **home**: [components, pages, types]
- **integrations**: [components, hooks, pages, services, types]
- **live-demo**: [components, constants, hooks, pages, services, types]
- **metering**: [components, hooks, pages, services, types, __tests__]
- **plans**: [components, hooks, pages, services, types]
- **scraper**: [components, hooks, services, types]
- **settings**: [components, hooks, pages, services, types]
- **wallet**: [components, hooks, pages, services, types]

## 🧭 6. Diretriz de Uso para Agentes
1. Para verificar o raio de impacto de um campo ou contrato, localize o símbolo no `.agents/graph.json`.
2. NUNCA altere assinaturas de mensageria sem verificar consumidores em C# e handlers Python simultaneamente.
3. Mantenha queries em conformidade com as tabelas listadas na Seção 3 e isole queries por `TenantId`.