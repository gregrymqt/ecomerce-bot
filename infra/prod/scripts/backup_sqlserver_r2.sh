#!/usr/bin/env bash

# ==============================================================================
# Script de Backup Automático do SQL Server 2022 para Cloudflare R2 (S3 API)
# E-commerce Bot SaaS
# ==============================================================================
# Uso:
# 1. Torne executável: chmod +x infra/prod/scripts/backup_sqlserver_r2.sh
# 2. Adicione ao crontab (ex: diariamente às 03:00 UTC):
#    0 3 * * * /bin/bash /caminho/infra/prod/scripts/backup_sqlserver_r2.sh >> /var/log/sqlserver_backup.log 2>&1
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
MSSQL_DB="${MSSQL_DB:-EcommerceBotDb}"
R2_BUCKET="${R2_BUCKET_NAME:-ecommerce-bot-backups}"
DISCORD_WEBHOOK="${DISCORD_WEBHOOK_URL}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
START_TIME=$(date +%s)
HOST_TEMP_DIR="/tmp/sqlserver_backup_${TIMESTAMP}"
CONTAINER_BACKUP_DIR="/var/opt/mssql/backup"

mkdir -p "${HOST_TEMP_DIR}"

# Lista de bancos para backup (Aplicação + Sistema essencial, ignorando tempdb)
DATABASES=("${MSSQL_DB}" "master" "msdb")

send_discord_alert() {
    local status="$1"
    local message="$2"
    local color="$3"
    
    if [ -n "${DISCORD_WEBHOOK}" ]; then
        local payload=$(cat <<EOF
{
  "embeds": [
    {
      "title": "🗄️ SQL Server Backup - ${status}",
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

echo -e "${CYAN}======================================================================${NC}"
echo -e "${CYAN}  📦 [${TIMESTAMP}] Iniciando Backup Nativo do SQL Server 2022        ${NC}"
echo -e "${CYAN}======================================================================${NC}"

# 1. Execução do Backup Nativo com Compressão e Checksum no SQL Server
for DB in "${DATABASES[@]}"; do
    BAK_FILENAME="${DB}_${TIMESTAMP}.bak"
    CONTAINER_FILE="${CONTAINER_BACKUP_DIR}/${BAK_FILENAME}"
    HOST_FILE="${HOST_TEMP_DIR}/${BAK_FILENAME}"

    echo -e "${YELLOW}>> Gerando backup do banco '${DB}' com COMPRESSION e CHECKSUM...${NC}"
    
    BACKUP_SQL="BACKUP DATABASE [${DB}] TO DISK = N'${CONTAINER_FILE}' WITH COMPRESSION, CHECKSUM, INIT, STATS = 20;"
    
    if ! docker exec "${MSSQL_CONTAINER}" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -C -Q "${BACKUP_SQL}"; then
        echo -e "${RED}❌ ERRO: Falha ao gerar backup nativo do banco '${DB}'.${NC}"
        send_discord_alert "FALHA CRÍTICA" "❌ Falha ao executar BACKUP DATABASE [${DB}] via sqlcmd no container ${MSSQL_CONTAINER}." 15158332
        rm -rf "${HOST_TEMP_DIR}"
        exit 1
    fi

    # Copiar do container para o diretório de staging do host
    docker cp "${MSSQL_CONTAINER}:${CONTAINER_FILE}" "${HOST_FILE}"
    FILE_SIZE=$(du -h "${HOST_FILE}" | cut -f1)
    echo -e "${GREEN}✅ Backup de '${DB}' concluído com sucesso (${FILE_SIZE}).${NC}"
done

# 2. Upload para o Cloudflare R2 (S3 Compatible API)
TOTAL_SIZE=$(du -sh "${HOST_TEMP_DIR}" | cut -f1)
echo -e "\n${YELLOW}☁️ Sincronizando backups com Cloudflare R2 (Bucket: ${R2_BUCKET}/sqlserver/${TIMESTAMP}/)...${NC}"

UPLOAD_SUCCESS=false

if command -v rclone >/dev/null 2>&1; then
    echo -e "   • Utilizando Rclone para envio ao Cloudflare R2..."
    if rclone copy "${HOST_TEMP_DIR}/" "cloudflare-r2:${R2_BUCKET}/sqlserver/${TIMESTAMP}/" --fast-list; then
        UPLOAD_SUCCESS=true
        echo -e "${GREEN}✅ Backup enviado para o R2 com sucesso via Rclone!${NC}"
    fi
fi

if [ "${UPLOAD_SUCCESS}" = false ] && [ -n "${R2_ACCOUNT_ID}" ] && [ "${R2_ACCOUNT_ID}" != "seu_account_id_da_cloudflare" ]; then
    ENDPOINT_URL="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
    export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
    export AWS_DEFAULT_REGION="auto"

    if command -v aws >/dev/null 2>&1; then
        echo -e "   • Fallback: Utilizando AWS CLI para envio ao Cloudflare R2..."
        if aws s3 sync "${HOST_TEMP_DIR}" "s3://${R2_BUCKET}/sqlserver/${TIMESTAMP}" --endpoint-url "${ENDPOINT_URL}"; then
            UPLOAD_SUCCESS=true
            echo -e "${GREEN}✅ Backup enviado para o R2 com sucesso via AWS CLI!${NC}"
        fi
    else
        echo -e "   • Fallback: Utilizando Python Boto3 para envio ao Cloudflare R2..."
        python3 -c "
import os, sys
try:
    import boto3
    s3 = boto3.client('s3',
        endpoint_url='${ENDPOINT_URL}',
        aws_access_key_id='${R2_ACCESS_KEY_ID}',
        aws_secret_access_key='${R2_SECRET_ACCESS_KEY}',
        region_name='auto'
    )
    for fname in os.listdir('${HOST_TEMP_DIR}'):
        fpath = os.path.join('${HOST_TEMP_DIR}', fname)
        if os.path.isfile(fpath):
            s3.upload_file(fpath, '${R2_BUCKET}', f'sqlserver/${TIMESTAMP}/{fname}')
            print(f'   Uploaded {fname}')
    sys.exit(0)
except Exception as e:
    print(f'❌ Erro no upload via Python: {e}', file=sys.stderr)
    sys.exit(1)
" && UPLOAD_SUCCESS=true || UPLOAD_SUCCESS=false
    fi
fi

if [ "${UPLOAD_SUCCESS}" = false ]; then
    echo -e "${RED}❌ ERRO: Falha em todos os métodos de upload para o Cloudflare R2.${NC}"
    send_discord_alert "FALHA NO UPLOAD R2" "❌ O backup local foi gerado (${TOTAL_SIZE}), mas falhou a sincronização com o Cloudflare R2." 15158332
    exit 1
fi

# 3. Housekeeping Local (Manter apenas os últimos 2 dias no container e limpar temp host)
echo -e "\n${YELLOW}🧹 [3/3] Executando limpeza local (housekeeping)...${NC}"
rm -rf "${HOST_TEMP_DIR}"
docker exec "${MSSQL_CONTAINER}" /bin/bash -c "find ${CONTAINER_BACKUP_DIR} -name '*.bak' -mtime +2 -delete" || true
echo -e "${GREEN}✅ Limpeza concluída.${NC}"

# 4. Notificação de Sucesso no Discord
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo -e "\n${GREEN}🎉 Rotina de backup finalizada com sucesso em ${DURATION}s (Tamanho Total: ${TOTAL_SIZE})!${NC}"
send_discord_alert "SUCESSO" "✅ Backup diário com compressão concluído com sucesso e sincronizado no Cloudflare R2.\n\n**Bancos:** ${DATABASES[*]}\n**Tamanho:** ${TOTAL_SIZE}\n**Duração:** ${DURATION}s\n**Destino:** \`s3://${R2_BUCKET}/sqlserver/${TIMESTAMP}/\`" 3066993
