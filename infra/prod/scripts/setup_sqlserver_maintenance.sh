#!/usr/bin/env bash

# ==============================================================================
# Setup de Manutenção Automatizada & SQL Server Agent (Ola Hallengren)
# E-commerce Bot SaaS
# ==============================================================================
# Execução:
# chmod +x infra/prod/scripts/setup_sqlserver_maintenance.sh
# ./infra/prod/scripts/setup_sqlserver_maintenance.sh
# ==============================================================================

set -eo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
ENV_FILE="${REPO_ROOT}/infra/prod/.env.prod"
if [ ! -f "${ENV_FILE}" ]; then
    if [ -f "${REPO_ROOT}/infra/prod/.env" ]; then
        ENV_FILE="${REPO_ROOT}/infra/prod/.env"
    elif [ -f "${REPO_ROOT}/.env" ]; then
        ENV_FILE="${REPO_ROOT}/.env"
    fi
fi

if [ -f "${ENV_FILE}" ]; then
    set -a
    source "${ENV_FILE}" 2>/dev/null || export $(grep -v '^#' "${ENV_FILE}" | xargs)
    set +a
else
    echo -e "${YELLOW}⚠️ Aviso: Arquivo .env não encontrado. Utilizando variáveis de ambiente do sistema.${NC}"
fi

MSSQL_CONTAINER="${MSSQL_CONTAINER:-prod-mssql-bot}"
MSSQL_SA_PASSWORD="${MSSQL_SA_PASSWORD:-prod_mssql_password_secure}"

echo -e "${CYAN}======================================================================${NC}"
echo -e "${CYAN}  🛠️ Inicializando Setup de Manutenção do SQL Server 2022 em Docker  ${NC}"
echo -e "${CYAN}======================================================================${NC}"

# 1. Aguardar disponibilidade do SQL Server
echo -e "${YELLOW}⏳ Verificando conectividade com o container '${MSSQL_CONTAINER}'...${NC}"
MAX_RETRIES=30
RETRY_COUNT=0

until docker exec "${MSSQL_CONTAINER}" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -C -Q "SELECT 1" > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ ${RETRY_COUNT} -ge ${MAX_RETRIES} ]; then
        echo -e "${RED}❌ ERRO: Tempo limite excedido aguardando o SQL Server ficar pronto.${NC}"
        exit 1
    fi
    echo -e "   • Aguardando SQL Server responder... (${RETRY_COUNT}/${MAX_RETRIES})"
    sleep 3
done

echo -e "${GREEN}✅ SQL Server online e pronto para receber comandos!${NC}"

# 2. Configurar Limite de Memória e Paralelismo para 3 vCPUs
echo -e "\n${YELLOW}⚙️ [1/4] Configurando max server memory (2200 MB), MAXDOP (2) e Cost Threshold (50)...${NC}"
docker exec -i "${MSSQL_CONTAINER}" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -C <<EOF
EXEC sp_configure 'show advanced options', 1;
RECONFIGURE;
EXEC sp_configure 'max server memory (MB)', 2200;
EXEC sp_configure 'max degree of parallelism', 2;
EXEC sp_configure 'cost threshold for parallelism', 50;
RECONFIGURE;
GO
SELECT name, value_in_use FROM sys.configurations 
WHERE name IN ('max server memory (MB)', 'max degree of parallelism', 'cost threshold for parallelism');
GO
EOF
echo -e "${GREEN}✅ Limite de memória e paralelismo calibrados para 3 vCPUs!${NC}"

# 3. Otimizar tempdb Multi-Arquivo (3 vCPUs / Eliminação de PFS/GAM Contention)
echo -e "\n${YELLOW}⚡ [2/4] Configurando tempdb Multi-Arquivo (3 vCPUs) e Diretórios Padrão...${NC}"
docker exec -i "${MSSQL_CONTAINER}" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -C < "${SCRIPT_DIR}/setup_tempdb_linux.sql"
echo -e "${GREEN}✅ tempdb e diretórios de instância configurados!${NC}"

# 4. Instalar Stored Procedures Ola Hallengren (MaintenanceSolution.sql)
echo -e "\n${YELLOW}📦 [3/4] Instalando Stored Procedures do Ola Hallengren (master)...${NC}"
docker exec -i "${MSSQL_CONTAINER}" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -C < "${SCRIPT_DIR}/MaintenanceSolution.sql"
echo -e "${GREEN}✅ MaintenanceSolution.sql instalado com sucesso!${NC}"

# 5. Criar Jobs no SQL Server Agent
echo -e "\n${YELLOW}⏰ [4/4] Criando e Agendando Jobs no SQL Server Agent...${NC}"
docker exec -i "${MSSQL_CONTAINER}" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -C <<EOF
-- Garantir Recovery Model FULL para o banco de produção (imprescindível para RPO < 15 min e Log Truncation)
USE master;
GO
IF EXISTS (SELECT 1 FROM sys.databases WHERE name = N'EcommerceBotDb' AND recovery_model_desc <> 'FULL')
BEGIN
    PRINT '>> Ajustando modelo de recuperacao de EcommerceBotDb para FULL...';
    ALTER DATABASE [EcommerceBotDb] SET RECOVERY FULL;
END
GO

USE msdb;
GO

-- Limpeza de Jobs anteriores caso existam
IF EXISTS (SELECT job_id FROM msdb.dbo.sysjobs WHERE name = N'EcommerceBot_Weekly_IndexOptimize')
    EXEC msdb.dbo.sp_delete_job @job_name = N'EcommerceBot_Weekly_IndexOptimize';
GO

IF EXISTS (SELECT job_id FROM msdb.dbo.sysjobs WHERE name = N'EcommerceBot_Daily_UpdateStats')
    EXEC msdb.dbo.sp_delete_job @job_name = N'EcommerceBot_Daily_UpdateStats';
GO

IF EXISTS (SELECT job_id FROM msdb.dbo.sysjobs WHERE name = N'EcommerceBot_Weekly_IntegrityCheck')
    EXEC msdb.dbo.sp_delete_job @job_name = N'EcommerceBot_Weekly_IntegrityCheck';
GO

IF EXISTS (SELECT job_id FROM msdb.dbo.sysjobs WHERE name = N'EcommerceBot_15Min_TransactionLogBackup')
    EXEC msdb.dbo.sp_delete_job @job_name = N'EcommerceBot_15Min_TransactionLogBackup';
GO

-- Job 1: IndexOptimize Semanal (Domingos às 02:00 UTC)
DECLARE @jobId1 BINARY(16);
EXEC msdb.dbo.sp_add_job 
    @job_name = N'EcommerceBot_Weekly_IndexOptimize', 
    @enabled = 1, 
    @description = N'Desfragmentacao inteligente de indices semanal (Reorganize 5-30%, Rebuild > 30%)',
    @job_id = @jobId1 OUTPUT;

EXEC msdb.dbo.sp_add_jobstep 
    @job_id = @jobId1, 
    @step_name = N'Exec_IndexOptimize', 
    @subsystem = N'TSQL', 
    @command = N'EXEC master.dbo.IndexOptimize @Databases = ''USER_DATABASES'', @FragmentationLow = NULL, @FragmentationMedium = ''INDEX_REORGANIZE,INDEX_REBUILD_ONLINE'', @FragmentationHigh = ''INDEX_REBUILD_ONLINE,INDEX_REBUILD_OFFLINE'', @FragmentationLevel1 = 5, @FragmentationLevel2 = 30, @UpdateStatistics = NULL;', 
    @database_name = N'master';

EXEC msdb.dbo.sp_add_jobschedule 
    @job_id = @jobId1, 
    @name = N'Weekly_Sunday_0200', 
    @freq_type = 8, -- Weekly
    @freq_interval = 1, -- Sunday
    @freq_recurrence_factor = 1, 
    @active_start_time = 020000;

EXEC msdb.dbo.sp_add_jobserver @job_id = @jobId1, @server_name = N'(LOCAL)';
GO

-- Job 2: Atualização Diária de Estatísticas (Diariamente às 04:00 UTC)
DECLARE @jobId2 BINARY(16);
EXEC msdb.dbo.sp_add_job 
    @job_name = N'EcommerceBot_Daily_UpdateStats', 
    @enabled = 1, 
    @description = N'Atualizacao diaria de estatisticas modificadas',
    @job_id = @jobId2 OUTPUT;

EXEC msdb.dbo.sp_add_jobstep 
    @job_id = @jobId2, 
    @step_name = N'Exec_UpdateStats', 
    @subsystem = N'TSQL', 
    @command = N'EXEC master.dbo.IndexOptimize @Databases = ''USER_DATABASES'', @FragmentationLow = NULL, @FragmentationMedium = NULL, @FragmentationHigh = NULL, @UpdateStatistics = ''ALL'', @OnlyModifiedStatistics = ''Y'';', 
    @database_name = N'master';

EXEC msdb.dbo.sp_add_jobschedule 
    @job_id = @jobId2, 
    @name = N'Daily_0400', 
    @freq_type = 4, -- Daily
    @freq_interval = 1, 
    @active_start_time = 040000;

EXEC msdb.dbo.sp_add_jobserver @job_id = @jobId2, @server_name = N'(LOCAL)';
GO

-- Job 3: Verificação de Integridade Semanal (Sábados às 01:00 UTC - DBCC CHECKDB)
DECLARE @jobId3 BINARY(16);
EXEC msdb.dbo.sp_add_job 
    @job_name = N'EcommerceBot_Weekly_IntegrityCheck', 
    @enabled = 1, 
    @description = N'Verificacao semanal completa de integridade fisica e logica do banco',
    @job_id = @jobId3 OUTPUT;

EXEC msdb.dbo.sp_add_jobstep 
    @job_id = @jobId3, 
    @step_name = N'Exec_DatabaseIntegrityCheck', 
    @subsystem = N'TSQL', 
    @command = N'EXEC master.dbo.DatabaseIntegrityCheck @Databases = ''USER_DATABASES'', @CheckCommands = ''CHECKDB'', @PhysicalOnly = ''N'', @LogToTable = ''Y'';', 
    @database_name = N'master';

EXEC msdb.dbo.sp_add_jobschedule 
    @job_id = @jobId3, 
    @name = N'Weekly_Saturday_0100', 
    @freq_type = 8, -- Weekly
    @freq_interval = 64, -- Saturday
    @freq_recurrence_factor = 1, 
    @active_start_time = 010000;

EXEC msdb.dbo.sp_add_jobserver @job_id = @jobId3, @server_name = N'(LOCAL)';
GO

-- Job 4: Backup de Transaction Log a cada 15 Minutos (Truncamento de .ldf e RPO < 15 min)
DECLARE @jobId4 BINARY(16);
EXEC msdb.dbo.sp_add_job 
    @job_name = N'EcommerceBot_15Min_TransactionLogBackup', 
    @enabled = 1, 
    @description = N'Backup transacional continuo a cada 15 minutos para truncamento de log e RPO minimo',
    @job_id = @jobId4 OUTPUT;

EXEC msdb.dbo.sp_add_jobstep 
    @job_id = @jobId4, 
    @step_name = N'Exec_BackupLog', 
    @subsystem = N'TSQL', 
    @command = N'DECLARE @BackupFile NVARCHAR(500) = N''/var/opt/mssql/backup/EcommerceBotDb_LOG_'' + FORMAT(GETUTCDATE(), ''yyyyMMdd_HHmmss'') + N''.trn''; BACKUP LOG [EcommerceBotDb] TO DISK = @BackupFile WITH COMPRESSION, CHECKSUM, NOINIT;', 
    @database_name = N'master';

EXEC msdb.dbo.sp_add_jobschedule 
    @job_id = @jobId4, 
    @name = N'Recurring_15Minutes', 
    @freq_type = 4, -- Daily
    @freq_interval = 1, 
    @freq_subday_type = 4, -- Minutes
    @freq_subday_interval = 15, 
    @active_start_time = 000000;

EXEC msdb.dbo.sp_add_jobserver @job_id = @jobId4, @server_name = N'(LOCAL)';
GO

PRINT '>> Validando status dos Jobs cadastrados:';
SELECT name, enabled, date_created FROM msdb.dbo.sysjobs WHERE name LIKE 'EcommerceBot_%';
GO
EOF

echo -e "\n${GREEN}🎉 Setup de manutenção e SQL Server Agent concluído com 100% de sucesso!${NC}"
