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
