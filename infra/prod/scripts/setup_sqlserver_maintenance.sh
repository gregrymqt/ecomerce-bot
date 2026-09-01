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

# 2. Configurar Limite de Memória (max server memory = 2560 MB)
echo -e "\n${YELLOW}⚙️ [1/3] Configurando max server memory para 2560 MB...${NC}"
docker exec -i "${MSSQL_CONTAINER}" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -C <<EOF
EXEC sp_configure 'show advanced options', 1;
RECONFIGURE;
EXEC sp_configure 'max server memory (MB)', 2560;
RECONFIGURE;
GO
SELECT name, value_in_use FROM sys.configurations WHERE name = 'max server memory (MB)';
GO
EOF
echo -e "${GREEN}✅ Limite de memória configurado com sucesso!${NC}"

# 3. Instalar Stored Procedures Ola Hallengren (MaintenanceSolution.sql)
echo -e "\n${YELLOW}📦 [2/3] Instalando Stored Procedures do Ola Hallengren (master)...${NC}"
docker exec -i "${MSSQL_CONTAINER}" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -C < "${SCRIPT_DIR}/MaintenanceSolution.sql"
echo -e "${GREEN}✅ MaintenanceSolution.sql instalado com sucesso!${NC}"

# 4. Criar Jobs no SQL Server Agent
echo -e "\n${YELLOW}⏰ [3/3] Criando e Agendando Jobs no SQL Server Agent...${NC}"
docker exec -i "${MSSQL_CONTAINER}" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -C <<EOF
USE msdb;
GO

-- Limpeza de Jobs anteriores caso existam
IF EXISTS (SELECT job_id FROM msdb.dbo.sysjobs WHERE name = N'EcommerceBot_Weekly_IndexOptimize')
    EXEC msdb.dbo.sp_delete_job @job_name = N'EcommerceBot_Weekly_IndexOptimize';
GO

IF EXISTS (SELECT job_id FROM msdb.dbo.sysjobs WHERE name = N'EcommerceBot_Daily_UpdateStats')
    EXEC msdb.dbo.sp_delete_job @job_name = N'EcommerceBot_Daily_UpdateStats';
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

PRINT '>> Validando status dos Jobs cadastrados:';
SELECT name, enabled, date_created FROM msdb.dbo.sysjobs WHERE name LIKE 'EcommerceBot_%';
GO
EOF

echo -e "\n${GREEN}🎉 Setup de manutenção e SQL Server Agent concluído com 100% de sucesso!${NC}"
