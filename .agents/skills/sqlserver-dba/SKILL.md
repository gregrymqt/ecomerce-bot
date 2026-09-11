---
name: sqlserver-dba
description: "Guia canônico de engenharia de dados, T-SQL, isolamento multi-tenant, versionamento com DbUp, performance via RCSI/Query Store, manutenção com Ola Hallengren e backups R2 para SQL Server 2022 em Docker Linux."
---

# 🗄️ SQL Server SaaS — Manual Mestre de Engenharia, Resiliência e Operação

Este documento é a **fonte canônica de arquitetura, modelagem T-SQL, concorrência, observabilidade e governança de dados** para o **Microsoft SQL Server 2022 (Linux / Docker)** no ecossistema SaaS do **E-commerce Bot**.

---

## 🐳 1. Arquitetura do Container, Recursos e Storage no Linux

Para evitar gargalos de latência de gravação de logs, contenção de I/O e esgotamento de descritores no host:

### Limites de Instância e Kernel:
- **Imagem Base Oficial:** `mcr.microsoft.com/mssql/server:2022-latest` (Linux x86_64).
- **Ulimits Obrigatórios:** `nofile: soft: 65536, hard: 65536` (garante alta capacidade para conexões simultâneas e pools de conexão).
- **Topologia e Alocação de Memória:**
  - Limite de RAM do container no Docker Compose: `3072M` (3GB).
  - Parâmetro nativo `MSSQL_MEMORY_LIMIT_MB`: Configurado para **2560 MB** (80-85% da cota do container para prevenir terminação abrupta pelo Linux OOM Killer).
  ```sql
  EXEC sp_configure 'show advanced options', 1;
  RECONFIGURE;
  EXEC sp_configure 'max server memory (MB)', 2560;
  RECONFIGURE;
  ```

### Segregação Física de Volumes Docker:
É terminantemente proibido manter todos os arquivos em um único volume compartilhado. O storage deve ser particionado em 4 volumes nomeados dedicados:
1. `mssql-prod-data:/var/opt/mssql/data`: Arquivos primários e secundários de dados (`.mdf` e `.ndf`).
2. `mssql-prod-log:/var/opt/mssql/log`: Arquivos sequenciais transacionais (`.ldf`) isolados para mitigar latência síncrona de escrita.
3. `mssql-prod-tempdb:/var/opt/mssql/tempdb`: Volume volátil dedicado a operações de agregação, joins pesados e Version Store do RCSI.
4. `mssql-prod-backup:/var/opt/mssql/backup`: Ponto de montagem temporário para staging de backups diários e transacionais.

### Segurança de Rede:
- **Jamais expor `ports: - "1433:1433"` diretamente à internet pública.**
- Acesso de rede restrito à rede interna da stack Docker (`internal-net`) e, em caso de homologação/manutenção remota, exclusivamente via túnel SSH ou bind local restrito `127.0.0.1:1433:1433`.

---

## 🔒 2. Concorrência e Isolamento (Anti-Locking SaaS)

No SQL Server com isolamento pessimista padrão, transações de leitura colocam bloqueios compartilhados (`S`), bloqueando atualizações e inserções (`X`), o que provoca degradação severa sob múltiplos tenants consultando dashboards e workers consumindo filas concorrentemente.

### RCSI e Snapshot Isolation Obrigatórios:
Todo banco de dados de aplicação DEVE operar sob **Read Committed Snapshot Isolation (RCSI)** e permitir **Snapshot Isolation**:

```sql
-- Garante acesso exclusivo no momento da alternância
ALTER DATABASE [EcommerceBotDb] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;

-- Ativa versionamento de linha no tempdb para leituras sem lock
ALTER DATABASE [EcommerceBotDb] SET READ_COMMITTED_SNAPSHOT ON;

-- Permite transações em nível SNAPSHOT para relatórios e analytics
ALTER DATABASE [EcommerceBotDb] SET ALLOW_SNAPSHOT_ISOLATION ON;

ALTER DATABASE [EcommerceBotDb] SET MULTI_USER;
```

### Orquestração no DbUp:
Como instruções `ALTER DATABASE` não podem ser executadas dentro de transações de migração do DbUp (`WithTransactionPerScript`), o setup é encapsulado de forma transparente e resiliente na classe `DatabaseConfigurationHelper` antes da execução dos scripts DDL, verificando se os sinalizadores já estão ativos para evitar desconexões desnecessárias de usuários.

---

## ⚡ 3. Dimensionamento e Otimização de tempdb no Linux

Com o RCSI ativo, versões antigas de linhas em atualização/exclusão são deslocadas para o **Version Store** dentro do `tempdb`. Para eliminar contenção em páginas de alocação de espaço (`PFS`, `GAM`, `SGAM`):

### Configuração Multi-Arquivo Proporcional:
O `tempdb` deve ser estruturado com **4 arquivos de dados idênticos** (proporcionais a até 8 vCPUs disponíveis), com crescimento uniforme e teto de proteção:

```sql
USE master;
GO

-- 1. Redimensionar e redirecionar arquivos primários
ALTER DATABASE tempdb MODIFY FILE (
    NAME = 'tempdev', 
    FILENAME = '/var/opt/mssql/tempdb/tempdb.mdf', 
    SIZE = 256MB, 
    FILEGROWTH = 64MB,
    MAXSIZE = 2048MB
);

ALTER DATABASE tempdb MODIFY FILE (
    NAME = 'templog', 
    FILENAME = '/var/opt/mssql/tempdb/templog.ldf', 
    SIZE = 128MB, 
    FILEGROWTH = 64MB,
    MAXSIZE = 1024MB
);

-- 2. Adicionar arquivos secundários idênticos
ALTER DATABASE tempdb ADD FILE (NAME = 'tempdev2', FILENAME = '/var/opt/mssql/tempdb/tempdb_2.ndf', SIZE = 256MB, FILEGROWTH = 64MB, MAXSIZE = 2048MB);
ALTER DATABASE tempdb ADD FILE (NAME = 'tempdev3', FILENAME = '/var/opt/mssql/tempdb/tempdb_3.ndf', SIZE = 256MB, FILEGROWTH = 64MB, MAXSIZE = 2048MB);
ALTER DATABASE tempdb ADD FILE (NAME = 'tempdev4', FILENAME = '/var/opt/mssql/tempdb/tempdb_4.ndf', SIZE = 256MB, FILEGROWTH = 64MB, MAXSIZE = 2048MB);
GO
```

> [!IMPORTANT]
> A cláusula `MAXSIZE` é obrigatória no ambiente containerizado para evitar que transações atípicas ou queries de relatórios sem paginação esgotem o disco do host.

---

## 🛡️ 4. Segurança Operacional e Segregação de Credenciais

É estritamente proibido utilizar a conta de sistema `sa` nas connection strings de microsserviços, workers ou pipelines de CI/CD. O ecossistema adota o **Princípio do Menor Privilégio**:

| Papel / Login | Escopo de Acesso | Permissões Concedidas | Onde é Utilizado |
|---|---|---|---|
| **`sa`** | Global (Instância) | `sysadmin` | Apenas inicialização Day-Zero, backups nativos e jobs do SO. |
| **`usr_ecommerce_deployer`** | `EcommerceBotDb` | `db_owner` (escopo estrito ao banco) | Container de migrações (`Database.Migrations`) e pipeline de deploy. |
| **`usr_ecommerce_api`** | `EcommerceBotDb` | `db_datareader`, `db_datawriter`, `GRANT EXECUTE` | Runtime da API Central (`EcommerceBot.Core`) e microsserviços. |

### Script Canônico de Setup de Logins (`setup_sqlserver_credentials.sql`):
```sql
USE [master];
GO
CREATE LOGIN [usr_ecommerce_deployer] WITH PASSWORD = '$(MSSQL_DEPLOYER_PASSWORD)', CHECK_POLICY = ON, DEFAULT_DATABASE = [EcommerceBotDb];
CREATE LOGIN [usr_ecommerce_api] WITH PASSWORD = '$(MSSQL_API_PASSWORD)', CHECK_POLICY = ON, DEFAULT_DATABASE = [EcommerceBotDb];
GO

USE [EcommerceBotDb];
GO
CREATE USER [usr_ecommerce_deployer] FOR LOGIN [usr_ecommerce_deployer];
ALTER ROLE db_owner ADD MEMBER [usr_ecommerce_deployer];

CREATE USER [usr_ecommerce_api] FOR LOGIN [usr_ecommerce_api];
ALTER ROLE db_datareader ADD MEMBER [usr_ecommerce_api];
ALTER ROLE db_datawriter ADD MEMBER [usr_ecommerce_api];
GRANT EXECUTE TO [usr_ecommerce_api];
GRANT VIEW DATABASE STATE TO [usr_ecommerce_api];
GO
```

---

## 📜 5. Versionamento Determinístico com DbUp (.NET 8/9)

Todas as alterações estruturais do banco de dados são geridas via DbUp, garantindo deploys sem surpresas e rastreabilidade total:

### Convenções de Scripting:
- **Localização:** Scripts T-SQL em `Database.Migrations/Scripts/` ordenados numericamente com 3 dígitos (`001_...`, `002_...`, ..., `016_...`).
- **Idempotência DDL Obrigatória:** Todo script versionado DEVE ser idempotente, utilizando verificações prévias:
  - Tabelas e Índices: `IF NOT EXISTS (SELECT 1 FROM sys.tables ...)` / `IF NOT EXISTS (SELECT 1 FROM sys.indexes ...)`
  - Views e Stored Procedures: `CREATE OR ALTER VIEW` / `CREATE OR ALTER PROCEDURE`
  - Funções e Políticas RLS: `CREATE OR ALTER FUNCTION` / `DROP SECURITY POLICY IF EXISTS` seguido de `CREATE SECURITY POLICY`

---

## 🏛️ 6. Modelagem Canônica & Padrões de Índices Multi-Tenant

### Convenções Obrigatórias de Tipos de Dados:
- **Identificadores (IDs):** `UNIQUEIDENTIFIER` com `DEFAULT NEWSEQUENTIALID()`.
- **Coluna de Tenant Obrigatória:** `TenantId UNIQUEIDENTIFIER NOT NULL` com chave estrangeira para `dbo.Tenants(Id) ON DELETE CASCADE`.
- **Campos Temporais:** `DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()` (imutabilidade temporal com fuso horário UTC).
- **Valores Financeiros:** `DECIMAL(18,2)` para valores fiduciários; `BIGINT` para volumes e saldos de créditos de inteligência artificial.
- **Campos Criptografados (BYOK):** `VARBINARY(MAX)` acompanhado de `InitializationVector VARBINARY(16)` e `AuthTag VARBINARY(16)` para chaves AES-256 GCM.

### Ordenação Física e Índices Clustered:
- **Tabela `Tenants`:** Chave primária clustered simples em `Id`.
- **Tabelas Operacionais (`Products`, `Orders`, `StoreIntegrations`):** 
  - Adotar índice clustered composto em `(TenantId, Sku)` ou `(TenantId, CreatedAt DESC)` para colocalizar fisicamente os dados de um mesmo cliente nos mesmos blocos de disco (*extents*), otimizando seeks e eliminando *page splits* severos em reinicializações do container.
  - A chave primária lógica de identidade (`Id`) é mantida como `PRIMARY KEY NONCLUSTERED`.

### Diretriz Crítica de Collation e Prevenção de `CONVERT_IMPLICIT`:
- O banco opera sob collation UTF-8: `Latin1_General_100_CI_AS_SC_UTF8`.
- Textos extensos e descrições sem indexação de busca (`Description`, `ImagesJson`, `Metadata`) usam `NVARCHAR(MAX)` ou `VARCHAR(MAX)` UTF-8 com economia de ~50% de espaço.
- **Atenção Máxima com Dapper / C#:** O Dapper por padrão envia parâmetros de string como `NVarChar`. Colunas indexadas com buscas exatas por igualdade (`Sku`, `Slug`, `Email`) DEVEM permanecer tipadas como `NVARCHAR(n)`. Caso sejam declaradas como `VARCHAR(n)`, o SQL Server executará uma conversão implícita de tipo em tempo de execução (`CONVERT_IMPLICIT`), invalidando *Index Seeks* e forçando *Table Scans* com alto consumo de CPU.

### Índices de Cobertura e Filtrados:
```sql
-- 1. Índice de Cobertura (Eliminação de Key Lookups em Dashboards)
CREATE NONCLUSTERED INDEX IX_Orders_Tenant_CreatedAt
ON dbo.Orders (TenantId, CreatedAt DESC)
INCLUDE (TotalAmount, Status, PaymentMethod);

-- 2. Índice Filtrado (Worker consumindo fila de produtos pendentes)
CREATE NONCLUSTERED INDEX IX_Products_Pending_Processing
ON dbo.Products (TenantId, CreatedAt)
INCLUDE (Sku, Title, SourceUrl)
WHERE Status = 'RAW';
```

---

## ☁️ 7. Governança de Backups, Integridade e RPO < 15 Minutos

Para assegurar RPO < 15 minutos e integridade física comprovada sem risco de propagar corrupção para o Cloudflare R2:

### Matriz Operacional de Backups:
| Tipo de Backup | Frequência | Retenção Local | Retenção no Cloudflare R2 | Objetivo Primário |
|---|---|---|---|---|
| **FULL (Completo)** | Diário (02:00 UTC) | 2 dias (48h) | 30 a 60 dias (Lifecycle) | Base completa de restauração com checksum e compressão. |
| **TRANSACTION LOG** | A cada 15 minutos | 24 horas | 7 dias | Trunca ativamente o `.ldf` e cumpre **RPO < 15 min**. |
| **INTEGRITY CHECK** | Semanal (Sábados 01:00 UTC) | Gravado em `CommandLog` | N/A | `DBCC CHECKDB` completo pré-backup. |

### Checagem Pré-Backup Obrigatória:
Antes de executar o backup FULL, o script [backup_sqlserver_r2.sh](file:///c:/Users/digob/Desktop/ecommerce-bot/infra/prod/scripts/backup_sqlserver_r2.sh) executa uma checagem de integridade física (`DBCC CHECKDB ... PHYSICAL_ONLY`). Se houver corrupção, o backup é abortado imediatamente (*fail-closed*) e um alerta é emitido via webhook do Discord.

### Truncamento Contínuo do Transaction Log ([backup_sqlserver_log_r2.sh](file:///c:/Users/digob/Desktop/ecommerce-bot/infra/prod/scripts/backup_sqlserver_log_r2.sh)):
```sql
DECLARE @BackupFile NVARCHAR(500) = 
    N'/var/opt/mssql/backup/EcommerceBotDb_LOG_' + 
    FORMAT(GETUTCDATE(), 'yyyyMMdd_HHmmss') + N'.trn';

BACKUP LOG [EcommerceBotDb] 
TO DISK = @BackupFile 
WITH COMPRESSION, CHECKSUM, NOINIT;
```

### Homologação de Disaster Recovery ([restore_sqlserver_test.sh](file:///c:/Users/digob/Desktop/ecommerce-bot/infra/prod/scripts/restore_sqlserver_test.sh)):
Execução semestral obrigatória de teste de restauração em cadeia (`FULL .bak` com `NORECOVERY` seguido de `.trn` com `RECOVERY`) em banco isolado de homologação (`EcommerceBotDb_RestoreTest`).

---

## 🩺 8. Observabilidade, Query Store e Diagnóstico Operacional

O ecossistema disponibiliza views operacionais nativas em `Database.Migrations/Scripts/` para análise de saúde sem ferramentas invasivas:

### 1. Governança via Query Store:
O Query Store opera ativado com auto-capture para detecção de regressões de plano de execução:
```sql
ALTER DATABASE [EcommerceBotDb] SET QUERY_STORE = ON (
    OPERATION_MODE = READ_WRITE,
    CLEANUP_POLICY = (STALE_QUERY_THRESHOLD_DAYS = 30),
    DATA_FLUSH_INTERVAL_SECONDS = 900,
    MAX_STORAGE_SIZE_MB = 1024,
    QUERY_CAPTURE_MODE = AUTO,
    SIZE_BASED_CLEANUP_MODE = AUTO
);
```

### 2. Views Operacionais Disponíveis:
- **`dbo.vw_Monitor_Deadlocks`:** Captura o XML do Deadlock Graph a partir do ring buffer do Extended Event `system_health`.
- **`dbo.vw_Monitor_WaitStats`:** Ranking dos principais tipos de espera no servidor (excluindo processos ociosos de background) com percentual de sinal de CPU vs. I/O.
- **`dbo.vw_Monitor_VersionStore`:** Monitoramento do volume ocupado no `tempdb` pelo Version Store do RCSI.
- **`dbo.vw_Monitor_ActiveSnapshotTransactions`:** Inspeciona transações de longa duração que estejam bloqueando a limpeza do Version Store.
- **`dbo.vw_Monitor_MissingIndexes`:** Recomendações de índices com ganho de performance superior a 50%.
- **`dbo.vw_Monitor_TopQueries`:** Top 20 consultas com maior custo de CPU e leituras lógicas.
- **`dbo.vw_Monitor_TableSizes`:** Espaço em disco alocado, utilizado e contagem de linhas por tabela.

---

## 🛠️ 9. Rotinas de Manutenção Automatizadas (Ola Hallengren)

Configuradas via SQL Server Agent no script [setup_sqlserver_maintenance.sh](file:///c:/Users/digob/Desktop/ecommerce-bot/infra/prod/scripts/setup_sqlserver_maintenance.sh):

1. **`EcommerceBot_Weekly_IndexOptimize`:** Domingos às 02:00 UTC:
   - Fragmentação entre 5% e 30%: `INDEX_REORGANIZE`
   - Fragmentação > 30%: `INDEX_REBUILD_ONLINE`
2. **`EcommerceBot_Daily_UpdateStats`:** Diariamente às 04:00 UTC (`sp_updatestats` / `OnlyModifiedStatistics = 'Y'`).
3. **`EcommerceBot_Weekly_IntegrityCheck`:** Sábados às 01:00 UTC (`DBCC CHECKDB` completo).
4. **`EcommerceBot_15Min_TransactionLogBackup`:** Recorrente a cada 15 minutos para truncamento de `.ldf`.
