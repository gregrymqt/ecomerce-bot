#!/usr/bin/env bash

# ==============================================================================
# Script de Backup Automático do PostgreSQL para Cloudflare R2 (S3 Compatible API)
# E-commerce Bot SaaS
# ==============================================================================
# Uso:
# 1. Torne executável: chmod +x infra/prod/scripts/backup_postgres_r2.sh
# 2. Adicione ao crontab (ex: diariamente às 03:00):
#    0 3 * * * /bin/bash /caminho/infra/prod/scripts/backup_postgres_r2.sh >> /var/log/postgres_backup.log 2>&1
# ==============================================================================

set -eo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
ENV_FILE="${REPO_ROOT}/infra/prod/.env.prod"

if [ -f "${ENV_FILE}" ]; then
    # Carrega variáveis de ambiente ignorando comentários
    export $(grep -v '^#' "${ENV_FILE}" | xargs)
else
    echo -e "${RED}❌ ERRO: Arquivo .env.prod não encontrado em: ${ENV_FILE}${NC}"
    exit 1
fi

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-prod-postgres-bot}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-ecommerce_bot_db}"
R2_BUCKET="${R2_BUCKET_NAME:-ecommerce-bot-backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="postgres_backup_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
TEMP_BACKUP_PATH="/tmp/${BACKUP_FILENAME}"

echo -e "${GREEN}📦 [$(date)] Iniciando backup do banco de dados '${POSTGRES_DB}'...${NC}"

# 1. Geração do Dump do PostgreSQL comprimido via gzip
if docker exec -t "${POSTGRES_CONTAINER}" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" | gzip > "${TEMP_BACKUP_PATH}"; then
    BACKUP_SIZE=$(du -h "${TEMP_BACKUP_PATH}" | cut -f1)
    echo -e "${GREEN}✅ Dump gerado com sucesso em: ${TEMP_BACKUP_PATH} (Tamanho: ${BACKUP_SIZE})${NC}"
else
    echo -e "${RED}❌ ERRO: Falha ao gerar pg_dump do container '${POSTGRES_CONTAINER}'.${NC}"
    if [ -n "${DISCORD_WEBHOOK_URL}" ]; then
        curl -H "Content-Type: application/json" -X POST -d "{\"content\": \"🚨 **[ALERTA BACKUP FAILED]** Falha crítica ao gerar o pg_dump do PostgreSQL em $(hostname) na data ${TIMESTAMP}!\"}" "${DISCORD_WEBHOOK_URL}" || true
    fi
    exit 1
fi

# 2. Upload para o Cloudflare R2 (API S3 Compatible)
if [ -n "${R2_ACCOUNT_ID}" ] && [ "${R2_ACCOUNT_ID}" != "insira_seu_account_id_cloudflare_aqui" ]; then
    echo -e "${YELLOW}☁️ Enviando backup para o Cloudflare R2 (Bucket: ${R2_BUCKET})...${NC}"
    
    export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
    export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
    export AWS_DEFAULT_REGION="auto"

    ENDPOINT_URL="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

    if command -v aws >/dev/null 2>&1; then
        aws s3 cp "${TEMP_BACKUP_PATH}" "s3://${R2_BUCKET}/backups/${BACKUP_FILENAME}" --endpoint-url "${ENDPOINT_URL}"
        echo -e "${GREEN}✅ Backup enviado para o R2 com sucesso via AWS CLI!${NC}"
    elif command -v rclone >/dev/null 2>&1; then
        rclone copyto "${TEMP_BACKUP_PATH}" "r2:${R2_BUCKET}/backups/${BACKUP_FILENAME}"
        echo -e "${GREEN}✅ Backup enviado para o R2 com sucesso via Rclone!${NC}"
    else
        echo -e "${YELLOW}⚠️ AWS CLI ou Rclone não encontrados no sistema. Tentando upload via Python boto3...${NC}"
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
    s3.upload_file('${TEMP_BACKUP_PATH}', '${R2_BUCKET}', 'backups/${BACKUP_FILENAME}')
    print('✅ Upload via Python boto3 concluído com sucesso!')
except Exception as e:
    print(f'❌ Erro no upload via Python: {e}', file=sys.stderr)
    sys.exit(1)
"
    fi
else
    echo -e "${YELLOW}⚠️ Configurações do Cloudflare R2 ausentes ou incompletas no .env.prod. O backup local foi mantido em ${TEMP_BACKUP_PATH}.${NC}"
fi

# 3. Limpeza do arquivo temporário local após upload bem-sucedido
if [ -n "${R2_ACCOUNT_ID}" ] && [ "${R2_ACCOUNT_ID}" != "insira_seu_account_id_cloudflare_aqui" ]; then
    rm -f "${TEMP_BACKUP_PATH}"
    echo -e "${GREEN}🧹 Limpeza temporária concluída.${NC}"
fi

# 4. Alerta de Sucesso no Discord
if [ -n "${DISCORD_WEBHOOK_URL}" ]; then
    curl -H "Content-Type: application/json" -X POST -d "{\"content\": \"✅ **[BACKUP SUCCESS]** Backup do PostgreSQL ('${POSTGRES_DB}') realizado com sucesso e enviado ao Cloudflare R2! (Tamanho: ${BACKUP_SIZE})\"}" "${DISCORD_WEBHOOK_URL}" || true
fi

echo -e "${GREEN}🎉 Processo de backup concluído com sucesso em $(date)!${NC}"
