#!/usr/bin/env bash

# ==============================================================================
# Script de Backup Automático do PostgreSQL 16 para Cloudflare R2 (S3 API)
# E-commerce Bot SaaS
# ==============================================================================
# Uso:
# 1. Torne executável: chmod +x infra/prod/scripts/backup_postgres_r2.sh
# 2. Adicione ao crontab (ex: diariamente às 03:00 UTC):
#    0 3 * * * /bin/bash /caminho/infra/prod/scripts/backup_postgres_r2.sh >> /var/log/postgres_backup.log 2>&1
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

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-prod-postgres-bot}"
POSTGRES_USER="${POSTGRES_USER:-usr_ecommerce_api}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-prod_postgres_password_secure}"
POSTGRES_DB="${POSTGRES_DB:-ecommerce_bot_db}"
R2_BUCKET="${R2_BUCKET_NAME:-ecommerce-bot-backups}"
DISCORD_WEBHOOK="${DISCORD_WEBHOOK_URL}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
START_TIME=$(date +%s)
HOST_TEMP_DIR="/tmp/postgres_backup_${TIMESTAMP}"
CONTAINER_TEMP_DIR="/tmp"

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
      "title": "🗄️ PostgreSQL Backup - ${status}",
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
echo -e "${CYAN}  📦 [${TIMESTAMP}] Iniciando Backup Nativo do PostgreSQL 16          ${NC}"
echo -e "${CYAN}======================================================================${NC}"

# 0. Verificação Prévia de Prontidão (pg_isready)
echo -e "${YELLOW}🩺 [0/3] Verificando conectividade e integridade do PostgreSQL no banco '${POSTGRES_DB}'...${NC}"

if ! docker exec "${POSTGRES_CONTAINER}" pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" > /dev/null 2>&1; then
    echo -e "${RED}❌ ERRO FATAL: PostgreSQL não está respondendo no container '${POSTGRES_CONTAINER}'. Abortando backup.${NC}"
    send_discord_alert "FALHA CRÍTICA" "❌ PostgreSQL não está pronto (pg_isready) no banco '${POSTGRES_DB}' no container '${POSTGRES_CONTAINER}'. Backup abortado." 15158332
    rm -rf "${HOST_TEMP_DIR}"
    exit 1
fi
echo -e "${GREEN}✅ PostgreSQL pronto e acessível!${NC}\n"

# 1. Execução do Backup com pg_dump (Custom Format comprimido -Fc)
DUMP_FILENAME="${POSTGRES_DB}_${TIMESTAMP}.dump"
CONTAINER_FILE="${CONTAINER_TEMP_DIR}/${DUMP_FILENAME}"
HOST_FILE="${HOST_TEMP_DIR}/${DUMP_FILENAME}"

echo -e "${YELLOW}>> Gerando dump do banco '${POSTGRES_DB}' com pg_dump (-F c, blobs inclusos)...${NC}"

if ! docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${POSTGRES_CONTAINER}" \
    pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -F c -b -v -f "${CONTAINER_FILE}" > /dev/null 2>&1; then
    echo -e "${RED}❌ ERRO: Falha ao executar pg_dump no container '${POSTGRES_CONTAINER}'.${NC}"
    send_discord_alert "FALHA NO DUMP" "❌ Falha ao executar pg_dump para o banco '${POSTGRES_DB}' no container '${POSTGRES_CONTAINER}'." 15158332
    rm -rf "${HOST_TEMP_DIR}"
    exit 1
fi

# Copiar dump para o diretório de staging no host e remover do container
docker cp "${POSTGRES_CONTAINER}:${CONTAINER_FILE}" "${HOST_FILE}"
docker exec "${POSTGRES_CONTAINER}" rm -f "${CONTAINER_FILE}" || true

DUMP_SIZE=$(du -h "${HOST_FILE}" | cut -f1)
echo -e "${GREEN}✅ Dump do PostgreSQL concluído com sucesso (${DUMP_SIZE}).${NC}"

# 2. Upload para o Cloudflare R2 (S3 Compatible API)
TOTAL_SIZE=$(du -sh "${HOST_TEMP_DIR}" | cut -f1)
echo -e "\n${YELLOW}☁️ Sincronizando backup com Cloudflare R2 (Bucket: ${R2_BUCKET}/postgres/${TIMESTAMP}/)...${NC}"

UPLOAD_SUCCESS=false

if command -v rclone >/dev/null 2>&1; then
    echo -e "   • Utilizando Rclone para envio ao Cloudflare R2..."
    if rclone copy "${HOST_TEMP_DIR}/" "cloudflare-r2:${R2_BUCKET}/postgres/${TIMESTAMP}/" --fast-list; then
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
        if aws s3 sync "${HOST_TEMP_DIR}" "s3://${R2_BUCKET}/postgres/${TIMESTAMP}" --endpoint-url "${ENDPOINT_URL}"; then
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
            s3.upload_file(fpath, '${R2_BUCKET}', f'postgres/${TIMESTAMP}/{fname}')
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
    send_discord_alert "FALHA NO UPLOAD R2" "❌ O backup local do PostgreSQL foi gerado (${TOTAL_SIZE}), mas falhou a sincronização com o Cloudflare R2." 15158332
    exit 1
fi

# 3. Housekeeping Local
echo -e "\n${YELLOW}🧹 [3/3] Executando limpeza local (housekeeping)...${NC}"
rm -rf "${HOST_TEMP_DIR}"
echo -e "${GREEN}✅ Limpeza de arquivos temporários concluída.${NC}"

# 4. Notificação de Sucesso
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo -e "\n${GREEN}🎉 Rotina de backup do PostgreSQL finalizada com sucesso em ${DURATION}s (Tamanho Total: ${TOTAL_SIZE})!${NC}"
send_discord_alert "SUCESSO" "✅ Backup diário do PostgreSQL 16 concluído com sucesso e sincronizado no Cloudflare R2.\n\n**Banco:** ${POSTGRES_DB}\n**Tamanho:** ${TOTAL_SIZE}\n**Duração:** ${DURATION}s\n**Destino:** \`s3://${R2_BUCKET}/postgres/${TIMESTAMP}/\`" 3066993
