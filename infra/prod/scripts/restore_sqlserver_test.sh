#!/usr/bin/env bash

# ==============================================================================
# Script de Validação de Disaster Recovery (Teste de Restauração de Backup)
# E-commerce Bot SaaS
# ==============================================================================
# Uso:
# chmod +x infra/prod/scripts/restore_sqlserver_test.sh
# ./infra/prod/scripts/restore_sqlserver_test.sh [caminho_ou_nome_do_bak]
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

if [ -f "${ENV_FILE}" ]; then
    export $(grep -v '^#' "${ENV_FILE}" | xargs)
fi

MSSQL_CONTAINER="${MSSQL_CONTAINER:-prod-mssql-bot}"
MSSQL_SA_PASSWORD="${MSSQL_SA_PASSWORD:-prod_mssql_password_secure}"
R2_BUCKET="${R2_BUCKET_NAME:-ecommerce-bot-backups}"

echo -e "${CYAN}======================================================================${NC}"
echo -e "${CYAN}  🧪 Teste de Homologação de Disaster Recovery (SQL Server 2022)       ${NC}"
echo -e "${CYAN}======================================================================${NC}"

TEST_DB="EcommerceBotDb_RestoreTest"
CONTAINER_RESTORE_DIR="/var/opt/mssql/backup"

# 1. Localizar ou Baixar arquivo .bak
BAK_FILE="$1"

if [ -z "${BAK_FILE}" ]; then
    echo -e "${YELLOW}🔍 Nenhum arquivo .bak informado. Buscando o backup mais recente no Cloudflare R2...${NC}"
    if command -v rclone >/dev/null 2>&1; then
        LATEST_REMOTE=$(rclone lsjson "cloudflare-r2:${R2_BUCKET}/sqlserver/" --recursive --files-only | grep -o '"Path":"[^"]*' | grep "EcommerceBotDb" | tail -n 1 | cut -d'"' -f4)
        if [ -n "${LATEST_REMOTE}" ]; then
            echo -e "   • Baixando backup remoto: ${LATEST_REMOTE}..."
            rclone copyto "cloudflare-r2:${R2_BUCKET}/sqlserver/${LATEST_REMOTE}" "/tmp/restore_test.bak"
            docker cp "/tmp/restore_test.bak" "${MSSQL_CONTAINER}:${CONTAINER_RESTORE_DIR}/restore_test.bak"
            CONTAINER_BAK="${CONTAINER_RESTORE_DIR}/restore_test.bak"
            rm -f "/tmp/restore_test.bak"
        fi
    fi
else
    if [ -f "${BAK_FILE}" ]; then
        docker cp "${BAK_FILE}" "${MSSQL_CONTAINER}:${CONTAINER_RESTORE_DIR}/restore_test.bak"
        CONTAINER_BAK="${CONTAINER_RESTORE_DIR}/restore_test.bak"
    else
        CONTAINER_BAK="${CONTAINER_RESTORE_DIR}/${BAK_FILE}"
    fi
fi

if [ -z "${CONTAINER_BAK}" ]; then
    echo -e "${RED}❌ ERRO: Não foi possível obter um arquivo de backup para restauração.${NC}"
    exit 1
fi

echo -e "\n${YELLOW}📦 [1/3] Inspecionando estrutura interna do arquivo .bak...${NC}"
docker exec "${MSSQL_CONTAINER}" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -C -Q "RESTORE FILELISTONLY FROM DISK = N'${CONTAINER_BAK}';"

echo -e "\n${YELLOW}🔄 [2/3] Restaurando banco de testes '${TEST_DB}' com WITH REPLACE...${NC}"
docker exec "${MSSQL_CONTAINER}" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -C <<EOF
IF EXISTS (SELECT name FROM sys.databases WHERE name = '${TEST_DB}')
BEGIN
    ALTER DATABASE [${TEST_DB}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [${TEST_DB}];
END
GO

RESTORE DATABASE [${TEST_DB}] 
FROM DISK = N'${CONTAINER_BAK}'
WITH REPLACE,
     MOVE 'EcommerceBotDb' TO '/var/opt/mssql/data/${TEST_DB}.mdf',
     MOVE 'EcommerceBotDb_log' TO '/var/opt/mssql/data/${TEST_DB}_log.ldf';
GO
EOF

echo -e "\n${YELLOW}🩺 [3/3] Validando integridade e contagem de tabelas do banco restaurado...${NC}"
docker exec "${MSSQL_CONTAINER}" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -C <<EOF
USE [${TEST_DB}];
GO

SELECT 
    t.name AS TableName, 
    SUM(p.rows) AS TotalRows
FROM sys.tables t
INNER JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
GROUP BY t.name
ORDER BY t.name;
GO

-- Limpeza do banco de teste
USE master;
GO
ALTER DATABASE [${TEST_DB}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
DROP DATABASE [${TEST_DB}];
GO
EOF

echo -e "\n${GREEN}🎉 Validação de Disaster Recovery finalizada com sucesso! O backup é íntegro e restaurável.${NC}"
