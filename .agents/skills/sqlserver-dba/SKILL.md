---
name: sqlserver-dba
description: "Guia mestre de arquitetura, modelagem T-SQL canônica, isolamento multi-tenant, versionamento com DbUp, performance, rotinas de manutenção via DMVs/Ola Hallengren e automação de backups resilientes no Cloudflare R2 para SQL Server em Docker/Linux no ecossistema SaaS."
---

# 🗄️ SQL Server SaaS — Arquitetura, Modelagem T-SQL, Performance & Backup

Este documento é a **fonte canônica de regras, modelagem e boas práticas para SQL Server 2022 em Docker/Linux** no ecossistema **E-commerce Bot**. 

---

## 🐳 1. Arquitetura do Container SQL Server no Docker Compose

### Imagem & Configuração Essencial:
- **Imagem Oficial:** `mcr.microsoft.com/mssql/server:2022-latest` (Linux x86_64).
- **Variáveis de Ambiente Obrigatórias:**
  - `ACCEPT_EULA=Y`
  - `MSSQL_SA_PASSWORD` (Segredo forte injetado via `.env` seguro)
  - `MSSQL_AGENT_ENABLED=true` (Essencial para rotas de manutenção e jobs agendados)
  - `MSSQL_PID=Developer` (ou `Standard` / `Enterprise` em produção)

### Gerenciamento de Memória & Persistência:
- **Limite no Docker Compose:** `deploy.resources.limits.memory: 3GB`.
- **Configuração Interna de Memória (`max server memory`):** Deve ser configurada para **2560 MB** (80-85% da RAM do container) para evitar OOM (Out Of Memory) no host Linux.
  ```sql
  EXEC sp_configure 'show advanced options', 1;
  RECONFIGURE;
  EXEC sp_configure 'max server memory (MB)', 2560;
  RECONFIGURE;
  ```
- **Volume Persistente:** Mapeamento em volume Docker nomeado: `mssql_data:/var/opt/mssql/data`.

---

## 📜 2. Versionamento Determinístico de Banco com DbUp (.NET 8)

Para garantir que deploys na VPS executem migrações de forma determinística, sem ORMs pesados gerando SQL ineficiente:

### Estrutura de Pastas no Projeto .NET:
```
Database.Migrations/
├── Scripts/
│   ├── 001_Initial_Tenancy_And_Users.sql
│   ├── 002_Products_And_Catalog.sql
│   ├── 003_Financial_Plans_And_Subscriptions.sql
│   ├── 004_Traffic_And_Attributions.sql
│   └── 005_Diagnostic_DMV_Views.sql
└── Program.cs  # Execução do DbUp via DeployChanges.To.SqlDatabase(...)
```

### Regra de Idempotência Obrigatória em T-SQL:
Todo script DDL versionado DEVE ser idempotente:
```sql
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Tenants' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.Tenants (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        Name NVARCHAR(150) NOT NULL,
        Slug NVARCHAR(100) NOT NULL,
        PlanTier NVARCHAR(50) NOT NULL DEFAULT 'FREE',
        CreditsBalance INT NOT NULL DEFAULT 0,
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        UpdatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_Tenants PRIMARY KEY CLUSTERED (Id)
    );
END
GO
```

---

## 🏛️ 3. Modelagem Relacional Canônica para E-commerce SaaS

### Convenções Obrigatórias de Tipos de Dados:
- **Identificadores (IDs):** `UNIQUEIDENTIFIER` com `DEFAULT NEWSEQUENTIALID()` (evita fragmentação de índice clustered comparado ao `NEWID()`).
- **Isolamento Multi-Tenant:** Toda tabela de dados DEVE conter a coluna `TenantId UNIQUEIDENTIFIER NOT NULL`.
- **Chaves Primárias / Lógicas de Negócio:**
  - `Tenants`: `Id UNIQUEIDENTIFIER PRIMARY KEY`
  - `Products`: Chave composta ou índice único `(TenantId, Sku)`
- **Valores Monetários & Cotas:** `DECIMAL(18,2)` para preços/reais; `INT` ou `BIGINT` para créditos.
- **Campos Temporais:** `DATETIMEOFFSET` com `SYSDATETIMEOFFSET()` (preserva timezone UTC com precisão milimétrica).
- **Strings e Textos:** `NVARCHAR(n)` para suportar UTF-8/Unicode. Use `NVARCHAR(MAX)` apenas para descrições longas ou JSON de enriquecimento.
- **Campos Criptografados (BYOK):** `VARBINARY(MAX)` ou `NVARCHAR(MAX)` para chaves de IA e tokens sensíveis encriptados via AES-256 GCM.

---

## ⚡ 4. Otimização de Performance, Chaves & Índices Non-Clustered

### 1. Índices com Cláusula `INCLUDE`:
Em rotas de alta frequência (como Dashboard e Extrato de Créditos), utilize índices de cobertura (*Covering Indexes*) com `INCLUDE` para eliminar *Key Lookups*:
```sql
CREATE NONCLUSTERED INDEX IX_Orders_Tenant_CreatedAt
ON dbo.Orders (TenantId, CreatedAt DESC)
INCLUDE (TotalAmount, Status, PaymentMethodId);
```

### 2. Índices Filtrados (*Filtered Indexes*):
Para tabelas grandes onde a maioria das consultas busca registros em estado específico (ex: produtos pendentes de enriquecimento):
```sql
CREATE NONCLUSTERED INDEX IX_Products_Pending_Processing
ON dbo.Products (TenantId, CreatedAt)
WHERE Status = 'RAW';
```

---

## 🛠️ 5. Manutenção Automatizada & SQL Server Agent (Ola Hallengren)

Em servidores de produção, a fragmentação de índices e a degradação de estatísticas reduzem drasticamente a velocidade das consultas.

### Rotinas Semanais via Job do SQL Server Agent:
1. **Solução Padrão:** Executar `MaintenanceSolution.sql` (Ola Hallengren).
2. **Desfragmentação Inteligente:**
   - Fragmentação entre **5% e 30%:** `INDEX_REORGANIZE` (Online, leve).
   - Fragmentação **> 30%:** `INDEX_REBUILD` (Com compressão).
3. **Atualização Diária de Estatísticas:**
   ```sql
   EXEC dbo.IndexOptimize 
       @Databases = 'USER_DATABASES', 
       @FragmentationLow = NULL, 
       @FragmentationMedium = 'INDEX_REORGANIZE,INDEX_REBUILD_ONLINE', 
       @FragmentationHigh = 'INDEX_REBUILD_ONLINE,INDEX_REBUILD_OFFLINE', 
       @UpdateStatistics = 'ALL';
   ```

---

## 🩺 6. Views de Diagnóstico & DMVs (Dynamic Management Views)

Crie views de monitoramento na pasta de migrações para inspecionar a saúde do banco sem ferramentas externas pesadas:

### 1. Índices Faltantes (`vw_Monitor_MissingIndexes`):
```sql
CREATE OR ALTER VIEW dbo.vw_Monitor_MissingIndexes AS
SELECT 
    mig.index_group_handle,
    mid.statement AS TableName,
    mid.equality_columns AS EqualityCols,
    mid.inequality_columns AS InequalityCols,
    mid.included_columns AS IncludedCols,
    migs.user_seeks,
    migs.avg_user_impact AS EstPercentageImprovement
FROM sys.dm_db_missing_index_groups mig
INNER JOIN sys.dm_db_missing_index_group_stats migs ON migs.group_handle = mig.index_group_handle
INNER JOIN sys.dm_db_missing_index_details mid ON mig.index_handle = mid.index_handle
WHERE migs.avg_user_impact > 50;
GO
```

### 2. Top 10 Queries Mais Lentas (`vw_Monitor_TopQueries`):
```sql
CREATE OR ALTER VIEW dbo.vw_Monitor_TopQueries AS
SELECT TOP 10
    qs.total_elapsed_time / qs.execution_count / 1000.0 AS AvgExecutionTimeMs,
    qs.total_worker_time / qs.execution_count / 1000.0 AS AvgCpuTimeMs,
    qs.execution_count,
    SUBSTRING(st.text, (qs.statement_start_offset/2)+1, 
        ((CASE qs.statement_end_offset WHEN -1 THEN DATALENGTH(st.text) ELSE qs.statement_end_offset END - qs.statement_start_offset)/2) + 1) AS QueryText
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
ORDER BY AvgExecutionTimeMs DESC;
GO
```

---

## ☁️ 7. Automação de Backup com Compressão & Sincronização no Cloudflare R2

### Estratégia de Backup Diário:
1. **Comando T-SQL Nativo com Compressão & Checksum:**
   ```sql
   BACKUP DATABASE [EcommerceBotDb] 
   TO DISK = '/var/opt/mssql/backup/EcommerceBotDb_YYYYMMDD_HHMM.bak'
   WITH COMPRESSION, CHECKSUM, INIT;
   ```
2. **Bancos do Sistema:** Fazer backup diário de `master` e `msdb` (ignorar `tempdb`).
3. **Upload com `rclone` para Cloudflare R2:**
   ```bash
   rclone copy /var/opt/mssql/backup/ cloudflare-r2:ecom-autobot-backups/sqlserver/ --fast-list
   ```
4. **Housekeeping Local & Nuvem:**
   - Local: `find /var/opt/mssql/backup/ -name "*.bak" -mtime +2 -delete`
   - Cloudflare R2: Política de ciclo de vida com expiração automática após 30 ou 60 dias.
5. **Alerta de Falha:** Disparo de webhook (Discord/Telegram) em caso de `exit code != 0`.
6. **Homologação Semestral:** Teste obrigatório de `RESTORE DATABASE ... FROM DISK = '...' WITH REPLACE` em container isolado.
