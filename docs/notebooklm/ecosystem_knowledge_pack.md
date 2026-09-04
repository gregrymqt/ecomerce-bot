# 📚 E-commerce Bot — Master Knowledge Pack & Technical Specification

> **Data de Compilação:** 2026-09-04 18:41:14 UTC  
> **Versão da Topologia:** v2.0 (113 nós, 54 arestas catalogadas)  
> **Finalidade:** Base de Conhecimento Canônica para Grounding e Consultas de Engenharia no **Google NotebookLM** (Card 83 do Trello).

---

## 🧭 Sumário do Knowledge Pack

1. [Módulo 1: Hub de APIs Externas, Gateways & Provedores](#módulo-1-hub-de-apis-externas-gateways--provedores)
   - Shopify GraphQL 2024+, `productSet`, `note_attributes` e Webhooks HMAC
   - Nuvemshop REST API v1 e injeção no checkout
   - Mercado Pago Checkout Transparente (PIX / CC / Assinaturas)
   - OpenRouter LLM Provider com cadeia de fallback e telemetria
2. [Módulo 2: Dicionário de Dados SQL Server & Multi-Tenancy](#módulo-2-dicionário-de-dados-sql-server--multi-tenancy)
   - Regras de isolamento multi-tenant estrito e Dapper
   - Dicionário completo das tabelas (`dbo.Tenants`, `dbo.Products`, `dbo.Orders`, etc.)
   - Auditoria via DMVs e servidor MCP
3. [Módulo 3: Modelos de Machine Learning, Analytics & Fórmulas](#módulo-3-modelos-de-machine-learning-analytics--fórmulas)
   - Arquitetura Tripartite de ML (Spark Batch, Inference Worker, NotebookLM)
   - Matriz RFM (KMeans, Silhouette, normalização logarítmica)
   - Algoritmos de Churn, LTV e Capacity Forecaster
   - Rastreamento e atribuição de tráfego Last-Click (`tracker.js`)
4. [Módulo 4: Infraestrutura, Mensageria, Observabilidade & Segurança](#módulo-4-infraestrutura-mensageria-observabilidade--segurança)
   - Topologia de filas RabbitMQ e MassTransit Raw JSON
   - Redis Cache, Idempotência, Rate Limit e SSE Pub/Sub
   - Servidor MCP de Diagnósticos (.NET 9)
   - Políticas de segurança corporativa fail-closed

---

\pagebreak

# 🌐 Módulo 1: Hub de APIs Externas, Gateways & Provedores

Este módulo documenta os contratos técnicos, protocolos de comunicação, estruturas de payload e regras de autenticação com todas as integrações de terceiros do ecossistema **E-commerce Bot**.

---

## 🛍️ 1. Shopify Admin API (GraphQL & Webhooks)

- **Versão da API:** GraphQL Admin API 2024-07+
- **Padrão de Autenticação:** Token de acesso via cabeçalho `X-Shopify-Access-Token`.
- **Biblioteca / Gateway:** `EcommerceBot.Infrastructure.Gateways.ShopifyGateway`

### 1.1. Mutação de Produtos (`productSet`)
Para sincronização atômica de catálogo (criação e atualização de produtos, variações de SKU, preços e imagens):

```graphql
mutation productSet($input: ProductSetInput!) {
  productSet(input: $input) {
    product {
      id
      title
      handle
      status
      variants(first: 10) {
        nodes {
          id
          sku
          price
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}
```

### 1.2. Injeção de Atribuição no Carrinho (`note_attributes`)
O script cliente [`tracker.js`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Web/public/tracker.js) captura as UTMs do comprador e faz o despacho automático para o carrinho da Shopify:
- **Endpoint:** `POST /cart/update.js`
- **Payload:**
```json
{
  "attributes": {
    "ec_utm_source": "instagram",
    "ec_utm_medium": "paid_social",
    "ec_utm_campaign": "blackfriday2026",
    "ec_ad_id": "ad_987654",
    "ec_session_id": "sess_1725463829_a8b9c"
  }
}
```

### 1.3. Webhooks & Validação de Segurança HMAC
- **Tópico Principal:** `orders/paid`
- **Cabeçalho:** `X-Shopify-Hmac-Sha256`
- **Regra Fail-Closed:** A verificação de assinatura calcula o hash HMAC-SHA256 do corpo bruto com a `ShopifyApiKeySecret` e compara estritamente com `CryptographicOperations.FixedTimeEquals` para prevenção de ataques de temporização (Timing Attacks).

---

## ☁️ 2. Nuvemshop REST API (V1)

- **Padrão de Autenticação:** `Authentication: bearer <access_token>` com `User-Agent: EcommerceBot (suporte@ecommercebot.com)`.
- **Gateway:** `EcommerceBot.Infrastructure.Gateways.NuvemshopGateway`.
- **Endpoints Chave:**
  - `GET /v1/{user_id}/products`: Leitura paginada do catálogo.
  - `POST /v1/{user_id}/products`: Criação de novos produtos enriquecidos pela IA.
  - `POST /v1/{user_id}/scripts`: Injeção do `tracker.js` no rodapé da loja.
- **Rastreamento:** Injeção de campos ocultos (`hidden inputs`) no formulário de checkout para propagação das variáveis `ec_utm_*`.

---

## 💳 3. Mercado Pago API (Checkout Transparente & Assinaturas)

- **Padrão de Autenticação:** `Authorization: Bearer <ACCESS_TOKEN>`
- **Gateway:** `EcommerceBot.Infrastructure.Gateways.MercadoPagoGateway`
- **Controller de Webhooks:** `MercadoPagoWebhookController` (`/api/v1/webhooks/mercadopago`)

### 3.1. Modalidades de Pagamento Suportadas
1. **PIX (Checkout Transparente):**
   - Criação via `POST /v1/payments` com `payment_method_id: "pix"`.
   - Retorna `point_of_interaction.transaction_data.qr_code` (Copia e Cola) e `qr_code_base64`.
2. **Cartão de Crédito Transparente:**
   - Tokenização no frontend via MercadoPago SDK (`device_id` anti-fraude).
   - Envio de `token`, `installments` e `payer.email`.
3. **Assinaturas Recorrentes (Preapproval):**
   - Criação de planos de assinatura mensal/anual via `POST /preapproval_plan` e `POST /preapproval`.

### 3.2. Idempotência e Segurança
- O identificador `data.id` ou `id` do webhook é checado no Redis com TTL de 24h via `SET NX` (`webhook:idempotency:{id}`). Duplicidades recebem `200 OK` imediato sem reprocessamento.
- Validação do cabeçalho `x-signature` com `x-request-id` usando chave secreta do webhook.

---

## 🤖 4. OpenRouter LLM API (Inference Engine)

- **Provedor:** `EcommerceBot.Worker.app.ai.providers.openrouter_provider.OpenRouterLLMProvider`
- **Endpoint:** `https://openrouter.ai/api/v1/chat/completions`
- **Cabeçalhos de Telemetria:**
  - `HTTP-Referer`: `https://ecommercebot.local`
  - `X-Title`: `EcommerceBot`
- **Cadeia de Fallback Resiliente:**
  1. `deepseek/deepseek-chat` (Alta velocidade e excelente copywriting em PT-BR)
  2. `meta-llama/llama-3.3-70b-instruct` (Capacidade de raciocínio profundo e estruturação JSON)
  3. `google/gemini-flash-1.5` (Baixíssima latência e ampla janela de contexto)
- **Política de Retentativas (Tenacity):** Retenta até 3 vezes com recuo exponencial (`wait_exponential(multiplier=1, min=2, max=10)`) em erros 429, 500, 502, 503 e 504.


---

\pagebreak

# 🗄️ Módulo 2: Dicionário de Dados SQL Server & Multi-Tenancy

Este módulo detalha o modelo de persistência relacional do **SQL Server 2022**, as migrações determinísticas versionadas com **DbUp** e as regras invioláveis de isolamento **Multi-Tenant**.

---

## 🔒 1. Princípios Invioláveis de Multi-Tenancy & Segurança

1. **Coluna de Tenant Obrigatória:** Toda tabela multi-tenant DEVE conter a coluna `TenantId UNIQUEIDENTIFIER NOT NULL` com Chave Estrangeira para `dbo.Tenants(Id) ON DELETE CASCADE`.
2. **Consultas Dapper Estritas (Fail-Closed):** É estritamente proibido executar consultas sem o filtro `WHERE TenantId = @TenantId` via parâmetros tipados.
3. **Chaves Primárias Sequenciais:** Todas as chaves primárias usam `UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID()`, reduzindo a fragmentação de páginas de índice no SQL Server.
4. **Campos Criptografados (BYOK):** Chaves de API do lojista são armazenadas como `VARBINARY(MAX)` (cifradas com AES-256 GCM), acompanhadas de `InitializationVector VARBINARY(16)` e `AuthTag VARBINARY(16)`.
5. **Índices de Cobertura com `INCLUDE`:** Consultas frequentes (como busca por SKU ou catálogo por status) usam cláusula `INCLUDE` para evitar Key Lookups caros.

---

## 📊 2. Dicionário de Tabelas do Banco de Dados

### 🗄️ Tabela `dbo.Tenants` (Script: `001_Initial_Tenancy_And_Users.sql`)
  - `Id`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `Name`: `NVARCHAR(150)` (NOT NULL)
  - `Slug`: `NVARCHAR(100)` (NOT NULL)
  - `PlanTier`: `NVARCHAR(50)` (NOT NULL)
  - `CreditsBalance`: `INT` (NOT NULL)
  - `IsActive`: `BIT` (NOT NULL)
  - `CreatedAt`: `DATETIMEOFFSET` (NOT NULL)
  - `UpdatedAt`: `DATETIMEOFFSET` (NOT NULL)

### 🗄️ Tabela `dbo.Users` (Script: `001_Initial_Tenancy_And_Users.sql`)
  - `Id`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `TenantId`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `Email`: `NVARCHAR(255)` (NOT NULL)
  - `PasswordHash`: `NVARCHAR(500)` (NOT NULL)
  - `FullName`: `NVARCHAR(150)` (NULL)
  - `Role`: `NVARCHAR(50)` (NOT NULL)
  - `IsActive`: `BIT` (NOT NULL)
  - `CreatedAt`: `DATETIMEOFFSET` (NOT NULL)
  - `UpdatedAt`: `DATETIMEOFFSET` (NOT NULL)
  - `REFERENCES`: `dbo` (NULL)

### 🗄️ Tabela `dbo.TenantAiCredentials` (Script: `001_Initial_Tenancy_And_Users.sql`)
  - `Id`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `TenantId`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `Provider`: `NVARCHAR(50)` (NOT NULL)
  - `EncryptedApiKey`: `VARBINARY(MAX)` (NOT NULL)
  - `InitializationVector`: `VARBINARY(32)` (NOT NULL)
  - `AuthTag`: `VARBINARY(32)` (NOT NULL)
  - `IsActive`: `BIT` (NOT NULL)
  - `CreatedAt`: `DATETIMEOFFSET` (NOT NULL)
  - `UpdatedAt`: `DATETIMEOFFSET` (NOT NULL)
  - `REFERENCES`: `dbo` (NULL)

### 🗄️ Tabela `dbo.Products` (Script: `002_Products_And_Catalog.sql`)
  - `Id`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `TenantId`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `Sku`: `NVARCHAR(100)` (NOT NULL)
  - `Title`: `NVARCHAR(500)` (NOT NULL)
  - `Description`: `NVARCHAR(MAX)` (NULL)
  - `OriginalPrice`: `DECIMAL(18` (NULL)
  - `Price`: `DECIMAL(18` (NULL)
  - `Category`: `NVARCHAR(200)` (NULL)
  - `Brand`: `NVARCHAR(150)` (NULL)
  - `StockQuantity`: `INT` (NOT NULL)
  - `Status`: `NVARCHAR(30)` (NOT NULL)
  - `SourceUrl`: `NVARCHAR(1000)` (NULL)
  - *...e mais 6 colunas.*

### 🗄️ Tabela `dbo.Plans` (Script: `003_Financial_Plans_And_Subscriptions.sql`)
  - `Id`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `Name`: `NVARCHAR(100)` (NOT NULL)
  - `Description`: `NVARCHAR(500)` (NULL)
  - `Price`: `DECIMAL(18` (NULL)
  - `CreditsIncluded`: `INT` (NOT NULL)
  - `BillingInterval`: `NVARCHAR(20)` (NOT NULL)
  - `MpPreapprovalPlanId`: `NVARCHAR(100)` (NULL)
  - `TrialDays`: `INT` (NOT NULL)
  - `IsActive`: `BIT` (NOT NULL)
  - `CreatedAt`: `DATETIMEOFFSET` (NOT NULL)
  - `UpdatedAt`: `DATETIMEOFFSET` (NOT NULL)

### 🗄️ Tabela `dbo.Subscriptions` (Script: `003_Financial_Plans_And_Subscriptions.sql`)
  - `Id`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `TenantId`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `PlanId`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `MpPreapprovalId`: `NVARCHAR(100)` (NULL)
  - `MpPayerId`: `NVARCHAR(100)` (NULL)
  - `Status`: `NVARCHAR(50)` (NOT NULL)
  - `CurrentPeriodStart`: `DATETIMEOFFSET` (NULL)
  - `CurrentPeriodEnd`: `DATETIMEOFFSET` (NULL)
  - `CancelledAt`: `DATETIMEOFFSET` (NULL)
  - `CreatedAt`: `DATETIMEOFFSET` (NOT NULL)
  - `UpdatedAt`: `DATETIMEOFFSET` (NOT NULL)
  - `REFERENCES`: `dbo` (NULL)
  - *...e mais 1 colunas.*

### 🗄️ Tabela `dbo.Orders` (Script: `003_Financial_Plans_And_Subscriptions.sql`)
  - `Id`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `TenantId`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `UserId`: `UNIQUEIDENTIFIER` (NULL)
  - `PlanId`: `UNIQUEIDENTIFIER` (NULL)
  - `TotalAmount`: `DECIMAL(18` (NULL)
  - `Currency`: `NVARCHAR(10)` (NOT NULL)
  - `Status`: `NVARCHAR(50)` (NOT NULL)
  - `PaymentMethod`: `NVARCHAR(50)` (NOT NULL)
  - `MpPaymentId`: `NVARCHAR(100)` (NULL)
  - `PixQrCode`: `NVARCHAR(MAX)` (NULL)
  - `PixQrCodeBase64`: `NVARCHAR(MAX)` (NULL)
  - `CardLastFourDigits`: `NVARCHAR(10)` (NULL)
  - *...e mais 8 colunas.*

### 🗄️ Tabela `dbo.TrafficAttributions` (Script: `004_Traffic_And_Attributions.sql`)
  - `Id`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `TenantId`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `OrderId`: `UNIQUEIDENTIFIER` (NULL)
  - `SessionId`: `NVARCHAR(100)` (NOT NULL)
  - `UtmSource`: `NVARCHAR(100)` (NULL)
  - `UtmMedium`: `NVARCHAR(100)` (NULL)
  - `UtmCampaign`: `NVARCHAR(150)` (NULL)
  - `UtmTerm`: `NVARCHAR(150)` (NULL)
  - `UtmContent`: `NVARCHAR(150)` (NULL)
  - `AdId`: `NVARCHAR(100)` (NULL)
  - `FbClid`: `NVARCHAR(250)` (NULL)
  - `GClid`: `NVARCHAR(250)` (NULL)
  - *...e mais 5 colunas.*

### 🗄️ Tabela `dbo.EnterpriseLeads` (Script: `006_Auth_And_EnterpriseLeads.sql`)
  - `Id`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `Email`: `NVARCHAR(255)` (NOT NULL)
  - `CompanyName`: `NVARCHAR(255)` (NULL)
  - `JobTitle`: `NVARCHAR(150)` (NULL)
  - `ExpectedVolume`: `NVARCHAR(100)` (NULL)
  - `IpAddress`: `NVARCHAR(50)` (NULL)
  - `CreatedAt`: `DATETIMEOFFSET` (NOT NULL)

### 🗄️ Tabela `dbo.LLMUsageLogs` (Script: `007_LLMUsageLogs_And_Balance.sql`)
  - `Id`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `TenantId`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `ProductId`: `NVARCHAR(150)` (NULL)
  - `Provider`: `NVARCHAR(100)` (NOT NULL)
  - `ModelUsed`: `NVARCHAR(100)` (NOT NULL)
  - `PromptTokens`: `INT` (NOT NULL)
  - `CompletionTokens`: `INT` (NOT NULL)
  - `TotalTokens`: `INT` (NOT NULL)
  - `EstimatedCostUsd`: `DECIMAL(18` (NULL)
  - `IsByok`: `BIT` (NOT NULL)
  - `ExecutionTimeMs`: `INT` (NULL)
  - `CreatedAt`: `DATETIMEOFFSET` (NOT NULL)
  - *...e mais 1 colunas.*

### 🗄️ Tabela `dbo.OrderItems` (Script: `008_Checkout_OrderItems.sql`)
  - `Id`: `INT` (NULL)
  - `OrderId`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `Title`: `NVARCHAR(150)` (NOT NULL)
  - `UnitPrice`: `DECIMAL(18` (NULL)
  - `Quantity`: `INT` (NOT NULL)
  - `ExternalCode`: `NVARCHAR(100)` (NULL)
  - `REFERENCES`: `dbo` (NULL)

### 🗄️ Tabela `dbo.EmailLogs` (Script: `009_EmailLogs.sql`)
  - `Id`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `TenantId`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `ResendId`: `NVARCHAR(128)` (NULL)
  - `Recipient`: `NVARCHAR(255)` (NOT NULL)
  - `EventType`: `NVARCHAR(64)` (NOT NULL)
  - `Status`: `NVARCHAR(50)` (NOT NULL)
  - `Subject`: `NVARCHAR(255)` (NOT NULL)
  - `IdempotencyKey`: `NVARCHAR(256)` (NULL)
  - `ErrorMessage`: `NVARCHAR(MAX)` (NULL)
  - `MetadataInfo`: `NVARCHAR(MAX)` (NOT NULL)
  - `CreatedAt`: `DATETIMEOFFSET` (NOT NULL)
  - `UpdatedAt`: `DATETIMEOFFSET` (NOT NULL)

### 🗄️ Tabela `dbo.TenantConfigs` (Script: `010_Tenant_Configs.sql`)
  - `Id`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `TenantId`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `AiSettingsJson`: `NVARCHAR(MAX)` (NULL)
  - `PricingSettingsJson`: `NVARCHAR(MAX)` (NULL)
  - `StoreProfileJson`: `NVARCHAR(MAX)` (NULL)
  - `CreatedAt`: `DATETIMEOFFSET` (NOT NULL)
  - `UpdatedAt`: `DATETIMEOFFSET` (NOT NULL)
  - `REFERENCES`: `dbo` (NULL)

### 🗄️ Tabela `dbo.SaasTrafficVisits` (Script: `012_Admin_Growth_And_Attributions.sql`)
  - `Id`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `SessionId`: `NVARCHAR(100)` (NOT NULL)
  - `Path`: `NVARCHAR(250)` (NOT NULL)
  - `UtmSource`: `NVARCHAR(100)` (NULL)
  - `UtmMedium`: `NVARCHAR(100)` (NULL)
  - `UtmCampaign`: `NVARCHAR(150)` (NULL)
  - `UtmContent`: `NVARCHAR(150)` (NULL)
  - `UtmTerm`: `NVARCHAR(150)` (NULL)
  - `AdId`: `NVARCHAR(100)` (NULL)
  - `FbClid`: `NVARCHAR(250)` (NULL)
  - `GClid`: `NVARCHAR(250)` (NULL)
  - `IpAddress`: `NVARCHAR(50)` (NULL)
  - *...e mais 3 colunas.*

### 🗄️ Tabela `dbo.SaasAdSpends` (Script: `012_Admin_Growth_And_Attributions.sql`)
  - `Id`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `CampaignName`: `NVARCHAR(150)` (NOT NULL)
  - `UtmSource`: `NVARCHAR(100)` (NOT NULL)
  - `AdId`: `NVARCHAR(100)` (NULL)
  - `AmountSpentBrl`: `DECIMAL(18` (NULL)
  - `PeriodStart`: `DATETIMEOFFSET` (NOT NULL)
  - `PeriodEnd`: `DATETIMEOFFSET` (NOT NULL)
  - `Notes`: `NVARCHAR(500)` (NULL)
  - `CreatedAt`: `DATETIMEOFFSET` (NOT NULL)

### 🗄️ Tabela `dbo.StoreIntegrations` (Script: `013_Store_Integrations.sql`)
  - `Id`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `TenantId`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `Platform`: `NVARCHAR(50)` (NOT NULL)
  - `StoreDomain`: `NVARCHAR(255)` (NOT NULL)
  - `EncryptedAccessToken`: `VARBINARY(MAX)` (NOT NULL)
  - `EncryptedClientSecret`: `VARBINARY(MAX)` (NULL)
  - `InitializationVector`: `VARBINARY(32)` (NOT NULL)
  - `AuthTag`: `VARBINARY(32)` (NOT NULL)
  - `Status`: `NVARCHAR(30)` (NOT NULL)
  - `HealthCheckStatus`: `NVARCHAR(200)` (NULL)
  - `HealthCheckLatencyMs`: `INT` (NULL)
  - `LastHealthCheckAt`: `DATETIMEOFFSET` (NULL)
  - *...e mais 3 colunas.*

### 🗄️ Tabela `dbo.Roles` (Script: `016_Roles_And_TenantSsoMappings.sql`)
  - `Id`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `Name`: `NVARCHAR(50)` (NOT NULL)
  - `Description`: `NVARCHAR(255)` (NOT NULL)
  - `IsSystemRole`: `BIT` (NOT NULL)
  - `CreatedAt`: `DATETIMEOFFSET` (NOT NULL)

### 🗄️ Tabela `dbo.TenantSsoMappings` (Script: `016_Roles_And_TenantSsoMappings.sql`)
  - `Id`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `TenantId`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `IdpGroupName`: `NVARCHAR(150)` (NOT NULL)
  - `RoleId`: `UNIQUEIDENTIFIER` (NOT NULL)
  - `IsDefaultRole`: `BIT` (NOT NULL)
  - `CreatedAt`: `DATETIMEOFFSET` (NOT NULL)
  - `UpdatedAt`: `DATETIMEOFFSET` (NOT NULL)
  - `REFERENCES`: `dbo` (NULL)
  - `REFERENCES`: `dbo` (NULL)


---

## ⚡ 3. Políticas de Auditoria & DMVs (Diagnostics MCP)

O servidor MCP de diagnósticos (`EcommerceBot.Diagnostics.Mcp`) realiza inspeções exclusivamente em DMVs nativas do SQL Server com `WITH (NOLOCK)`:
- `sys.dm_exec_query_stats` e `sys.dm_exec_sql_text`: Identificação das top 10 queries mais lentas ou com maior consumo de CPU.
- `sys.dm_tran_locks`: Detecção imediata de bloqueios e Deadlocks em transações concorrentes.
- `sys.dm_os_wait_stats`: Avaliação de gargalos de I/O de disco e concorrência de buffer pool.


---

\pagebreak

# 🔬 Módulo 3: Modelos de Machine Learning, Analytics & Fórmulas

Este módulo consolida a arquitetura analítica e preditiva do **E-commerce Bot**, detalhando as fórmulas matemáticas, hiperparâmetros, pipelines de treinamento e regras de classificação implementadas.

---

## 🏛️ 1. Arquitetura Tripartite de Machine Learning

1. **Batch & Data Plane (Google Spark / PySpark):**
   - Processamento de grandes volumes históricos de vendas e eventos de catálogo.
   - Treinamento em lote, calibração de centróides e exportação de pipelines serializados (`.joblib` / `.onnx`).
   - Geração de relatórios sem PII para estudo no Google NotebookLM.
2. **Runtime Inference Plane (FastAPI / aio-pika):**
   - Inferência em memória (< 50ms) no microsserviço Python (`EcommerceBot.Worker`).
   - Comunicação via filas RabbitMQ (`queue:analytics_ml` -> `queue:analytics_processed`).
   - Zero acesso direto ao banco de dados SQL Server.
3. **Knowledge & Research Plane (Google NotebookLM):**
   - Grounding de métricas analíticas, auditoria de acurácia e estudo executivo.

---

## 📐 2. Fórmulas Matemáticas & Especificações dos Algoritmos

### 2.1. Matriz RFM (Recência, Frequência e Valor Monetário)
Implementado em [`rfm_segmentation.py`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Worker/app/ml/rfm_segmentation.py) e [`batch_pipeline.py`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Worker/app/ml/spark/batch_pipeline.py).

- **Cálculo das Variáveis Base:**
  $$\text{Recência } (R) = \max(0, \text{Data de Referência} - \max(\text{Data do Pedido}))$$
  $$\text{Frequência } (F) = \sum 1 \quad \text{(Total de transações pagas do cliente)}$$
  $$\text{Monetário } (M) = \sum \text{Valor Líquido dos Pedidos}$$

- **Estabilização & Normalização:**
  A distribuição de frequência e valor é tipicamente assimétrica à direita (cauda longa). Aplica-se a transformação logarítmica seguida de padronização z-score:
  $$X_{\log} = \ln(1 + X)$$
  $$Z = \frac{X_{\log} - \mu}{\sigma}$$

- **Clusterização KMeans & Silhueta:**
  - Hiperparâmetros: $K = 4$ clusters, `random_state=42`, `n_init=10`.
  - Métrica de Validação: Silhouette Score:
    $$s(i) = \frac{b(i) - a(i)}{\max(a(i), b(i))}$$
    *(Onde $a(i)$ é a distância intra-cluster e $b(i)$ é a distância média até o cluster vizinho mais próximo).*

- **Segmentos de Negócio Atribuídos:**
  1. **Campeões (VIP):** Menor recência, altíssima frequência e maior ticket. Ação: Clube de benefícios exclusivos.
  2. **Clientes Fiéis:** Frequência constante e valor moderado/alto. Ação: Cross-sell e novidades.
  3. **Em Risco:** Clientes que compravam com frequência mas a recência ultrapassou a média. Ação: E-mail com cupom de reativação imediata.
  4. **Inativos / Ocasionais:** Baixa frequência e alta recência. Ação: Campanhas de remarketing de baixo custo.

---

### 2.2. Previsão de Churn (`churn_predictor.py`)
- **Definição Operacional:** Considera-se cliente em churn aquele que não realiza compra há mais de 2x o intervalo médio de recompra da categoria (ou cancelou assinatura recorrente).
- **Features do Modelo:** `recency_days`, `order_interval_std`, `ticket_variance`, `refund_count`, `support_ticket_count`.
- **Modelos:** Ensembles baseados em Random Forest e Scikit-Learn com threshold de probabilidade calibrado para $P(\text{churn}) > 0.65$.

---

### 2.3. Projeção de LTV (Lifetime Value - `ltv_forecaster.py`)
- **Fórmula para E-commerce Transacional:**
  $$\text{LTV} = \text{Ticket Médio} \times \text{Frequência Anual de Compra} \times \text{Vida Média do Cliente (Anos)}$$
- **Fórmula para SaaS / Assinaturas:**
  $$\text{LTV} = \frac{\text{ARPU} \times \text{Margem de Contribuição}}{\text{Taxa de Churn Mensal}}$$

---

### 2.4. Atribuição de Tráfego Last-Click (`tracker.js` + SQL)
- **Script:** [`tracker.js`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Web/public/tracker.js)
- **Parâmetros Capturados:** `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `ad_id`, `fbclid`, `gclid`.
- **Regra Last-Click:** O cookie `_ec_traffic_utm` grava a última visita (TTL 30 dias). Na finalização do pedido, os atributos gravam a sessão no pedido e o Core API persiste na tabela `dbo.TrafficAttributions`.


---

\pagebreak

# 📡 Módulo 4: Infraestrutura, Mensageria, Observabilidade & Segurança

Este módulo detalha a espinha dorsal de infraestrutura do sistema, as regras de mensageria com **MassTransit & RabbitMQ**, a camada de cache e eventos com **Redis**, os servidores **MCP** e as políticas de segurança corporativa.

---

## 🐇 1. Mensageria MassTransit & RabbitMQ

Para garantir interoperabilidade entre o Core C# (.NET 8/9) e o Worker Python (FastAPI / aio-pika), a serialização é configurada com **Raw JSON**:
```csharp
cfg.UseRawJsonSerializer();
```

### Topologia de Filas
| Fila | Finalidade | Produtor | Consumidor |
|---|---|---|---|
| `queue:ecommerce` | Ingestão de URLs para scraping e enriquecimento por IA | `EcommerceBot.Core` | `ScraperWorker` (Python) |
| `queue:demo_ecommerce` | Demonstração interativa e testes rápidos | `EcommerceBot.Web` / Core | `ScraperWorker` (Python) |
| `ecommerce_processed_queue` | Retorno de produtos enriquecidos | `ScraperWorker` (Python) | `ProcessedProductConsumer` (C#) |
| `queue:analytics_ml` | Transações para inferência de RFM/Churn | `EcommerceBot.Core` | `MLWorker` (Python) |
| `email_notifications` | Notificações e e-mails transacionais (Resend) | `EcommerceBot.Core` | `EmailNotificationConsumer` (C#) |
| `shopify_bulk_sync` | Sincronização em lote de catálogo Shopify | `EcommerceBot.Core` | `ShopifyBulkSyncConsumer` (C#) |
| `nuvemshop_bulk_sync` | Sincronização em lote de catálogo Nuvemshop | `EcommerceBot.Core` | `NuvemshopBulkSyncConsumer` (C#) |

---

## ⚡ 2. Redis: Cache, Idempotência, Rate Limit & SSE

1. **Idempotência de Webhooks:**
   Evita processamento concorrente ou repetido de webhooks:
   ```csharp
   await _redis.StringSetAsync($"webhook:idempotency:{id}", "processed", TimeSpan.FromHours(24), When.NotExists);
   ```
2. **Streaming em Tempo Real (SSE):**
   O canal `demo_stream_{correlationId}` recebe eventos de progresso publicados pelo Worker e republicados pelo Core como `text/event-stream`.
3. **Rate Limiting por Tenant:**
   Contadores de janela deslizante no Redis limitam requisições de scraping e chamadas de inferência para evitar abuso e proteger as cotas dos planos.

---

## 🩺 3. Model Context Protocol (MCP) — Servidor de Diagnósticos

- **Projeto:** `EcommerceBot.Diagnostics.Mcp` (.NET 9 Console)
- **Transporte:** Standard Input / Output (`stdio`)
- **Regras Fail-Closed:** Somente leitura (`WITH (NOLOCK)` em DMVs), sanitização estrita de segredos (chaves de API e senhas mascaradas).

### Ferramentas Nativas Registradas
1. `check_sql_health`: CPU, consultas lentas e locks no SQL Server.
2. `check_redis_metrics`: Consumo de memória, conexões clientes e taxa de hit/miss.
3. `inspect_rabbitmq_queues`: Profundidade de mensagens acumuladas, contagem de consumidores ativos.
4. `get_recent_application_errors`: Leitura dos últimos erros estruturados em `logs/errors-*.json` sem travar a API.

---

## 🛡️ 4. Regras de Segurança SaaS Invioláveis

1. **Fail-Closed em Segredos:** Proibido o uso de `?? "default_secret"` para chaves JWT ou criptográficas. Disparo imediato de `InvalidOperationException`.
2. **Prevenção de SSRF:** O scraper bloqueia esquemas não-HTTP e endereços IP de loopback (`127.0.0.1`, `localhost`), redes privadas RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) e metadados de nuvem (`169.254.169.254`).
3. **Validação de HMAC em Tempo Constante:** Prevenção de timing attacks via `CryptographicOperations.FixedTimeEquals`.
4. **Zero Acesso a Banco no Python Worker:** O microsserviço Python comunica-se exclusivamente através do RabbitMQ e Redis.


---

## 💡 Guia de Perguntas Recomendadas para o Google NotebookLM

Após fazer o upload deste arquivo no seu caderno do NotebookLM, utilize os seguintes prompts para validar decisões de arquitetura e código:

1. *"Com base nas tabelas do SQL Server e nos contratos de DTO, gere uma query T-SQL otimizada para agregar as vendas por utm_source respeitando o isolamento do TenantId."*
2. *"Quais são os passos exatos e o payload necessário para sincronizar um produto na Shopify usando a mutation productSet com note_attributes?"*
3. *"Explique como o modelo de RFM calcula a recência e qual a fórmula aplicada para estabilização de assimetria dos dados antes do KMeans."*
4. *"Quais filas do RabbitMQ participam do fluxo assíncrono de extração de produtos e como o Raw JSON serializer garante a compatibilidade entre C# e Python?"*
5. *"Qual a política de tratamento de webhooks duplicados no Mercado Pago usando Redis?"*
