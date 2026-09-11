#!/usr/bin/env bash

# ==============================================================================
# Script de Backup Contínuo de Transaction Log (.trn) para Cloudflare R2
# E-commerce Bot SaaS — RPO < 15 minutos & Truncamento Ativo do .ldf
# ==============================================================================
# Uso:
# 1. Torne executável: chmod +x infra/prod/scripts/backup_sqlserver_log_r2.sh
# 2. Agende no crontab do host (a cada 15 minutos):
#    */15 * * * * /bin/bash /caminho/infra/prod/scripts/backup_sqlserver_log_r2.sh >> /var/log/sqlserver_log_backup.log 2>&1
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
fi

MSSQL_CONTAINER="${MSSQL_CONTAINER:-prod-mssql-bot}"
MSSQL_SA_PASSWORD="${MSSQL_SA_PASSWORD:-prod_mssql_password_secure}"
MSSQL_DB="${MSSQL_DB:-EcommerceBotDb}"
R2_BUCKET="${R2_BUCKET_NAME:-ecommerce-bot-backups}"
DISCORD_WEBHOOK="${DISCORD_WEBHOOK_URL}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATE_PART=$(date +"%Y%m%d")
HOST_TEMP_DIR="/tmp/sqlserver_log_backup_${TIMESTAMP}"
CONTAINER_BACKUP_DIR="/var/opt/mssql/backup"

mkdir -p "${HOST_TEMP_DIR}"

send_discord_alert() {
    local status="$1"
    local message="$2"
    local color="$3"
    
    if [ -n "${DISCORD_WEBHOOK}" ]; then
        local payload=$(cat <<EOF
{
  "embeds": [
    {
      "title": "🗄️ SQL Server Log Backup - ${status}",
      "description": "${message}",
      "color": ${color},
      "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
      "footer": {
        "text": "E-commerce Bot Infrastructure • Host: $(hostname)"
      }
    }
  ]
}
EOF
)
        curl -s -H "Content-Type: application/json" -X POST -d "${payload}" "${DISCORD_WEBHOOK}" > /dev/null 2>&1 || true
    fi
}

# 1. Verificar se o SQL Server está responsivo
if ! docker exec "${MSSQL_CONTAINER}" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -C -Q "SELECT 1" > /dev/null 2>&1; then
    echo -e "${RED}❌ ERRO: Container SQL Server '${MSSQL_CONTAINER}' inacessível.${NC}"
    send_discord_alert "FALHA CRÍTICA" "❌ SQL Server offline ou inacessível para backup do Transaction Log." 15158332
    rm -rf "${HOST_TEMP_DIR}"
    exit 1
fi

# 2. Garantir que o banco de dados está em RECOVERY FULL (necessário para backup de log)
RECOVERY_CHECK_SQL="IF (SELECT recovery_model_desc FROM sys.databases WHERE name = N'${MSSQL_DB}') <> 'FULL' ALTER DATABASE [${MSSQL_DB}] SET RECOVERY FULL;"
docker exec "${MSSQL_CONTAINER}" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -C -Q "${RECOVERY_CHECK_SQL}" > /dev/null 2>&1 || true

# 3. Execução do BACKUP LOG com Compressão e Checksum
TRN_FILENAME="${MSSQL_DB}_LOG_${TIMESTAMP}.trn"
CONTAINER_FILE="${CONTAINER_BACKUP_DIR}/${TRN_FILENAME}"
HOST_FILE="${HOST_TEMP_DIR}/${TRN_FILENAME}"

BACKUP_LOG_SQL="BACKUP LOG [${MSSQL_DB}] TO DISK = N'${CONTAINER_FILE}' WITH COMPRESSION, CHECKSUM, NOINIT;"

if ! docker exec "${MSSQL_CONTAINER}" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -C -Q "${BACKUP_LOG_SQL}" > /dev/null 2>&1; then
    echo -e "${RED}❌ ERRO: Falha ao executar BACKUP LOG do banco '${MSSQL_DB}'.${NC}"
    send_discord_alert "FALHA LOG BACKUP" "❌ Falha ao executar BACKUP LOG [${MSSQL_DB}] no container ${MSSQL_CONTAINER}. Verifique se foi executado um backup FULL prévio." 15158332
    rm -rf "${HOST_TEMP_DIR}"
    exit 1
fi

# 4. Copiar do container para staging local
docker cp "${MSSQL_CONTAINER}:${CONTAINER_FILE}" "${HOST_FILE}"
FILE_SIZE=$(du -h "${HOST_FILE}" | cut -f1)

# 5. Sincronização com Cloudflare R2 (pasta particionada por dia)
UPLOAD_SUCCESS=false

if command -v rclone >/dev/null 2>&1; then
    if rclone copy "${HOST_FILE}" "cloudflare-r2:${R2_BUCKET}/sqlserver/logs/${DATE_PART}/" --fast-list > /dev/null 2>&1; then
        UPLOAD_SUCCESS=true
    fi
fi

if [ "${UPLOAD_SUCCESS}" = false ] && [ -n "${R2_ACCOUNT_ID}" ] && [ "${R2_ACCOUNT_ID}" != "seu_account_id_da_cloudflare" ]; then
    ENDPOINT_URL="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
    export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
    export AWS_DEFAULT_REGION="auto"

    if command -v aws >/dev/null 2>&1; then
        if aws s3 cp "${HOST_FILE}" "s3://${R2_BUCKET}/sqlserver/logs/${DATE_PART}/${TRN_FILENAME}" --endpoint-url "${ENDPOINT_URL}" > /dev/null 2>&1; then
            UPLOAD_SUCCESS=true
        fi
    fi
fi

if [ "${UPLOAD_SUCCESS}" = false ]; then
    echo -e "${RED}❌ ERRO: Falha no upload do arquivo .trn para o Cloudflare R2.${NC}"
    send_discord_alert "FALHA UPLOAD LOG R2" "❌ O backup de Transaction Log foi gerado localmente (${FILE_SIZE}), mas falhou o upload para o Cloudflare R2." 15158332
    rm -rf "${HOST_TEMP_DIR}"
    exit 1
fi

# 6. Housekeeping: Limpeza do staging do host e de .trn locais com mais de 24h
rm -rf "${HOST_TEMP_DIR}"
docker exec "${MSSQL_CONTAINER}" /bin/bash -c "find ${CONTAINER_BACKUP_DIR} -name '*.trn' -mtime +1 -delete" > /dev/null 2>&1 || true

echo -e "${GREEN}✅ [${TIMESTAMP}] Backup de Transaction Log concluído (${FILE_SIZE}) e sincronizado com Cloudflare R2.${NC}"
