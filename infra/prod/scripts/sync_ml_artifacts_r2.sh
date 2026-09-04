#!/usr/bin/env bash

# ==============================================================================
# Script de Sincronização de Artefatos de ML (Cloudflare R2 -> VPS)
# E-commerce Bot SaaS - MLOps VPS Sync
# ==============================================================================
# Uso:
# 1. Torne executável: chmod +x infra/prod/scripts/sync_ml_artifacts_r2.sh
# 2. Adicione ao crontab da VPS (ex: de hora em hora):
#    0 * * * * /bin/bash /caminho/infra/prod/scripts/sync_ml_artifacts_r2.sh >> /var/log/ml_artifacts_sync.log 2>&1
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

R2_BUCKET="${R2_BUCKET_NAME:-ecommerce-bot-backups}"
DISCORD_WEBHOOK="${DISCORD_WEBHOOK_URL}"
TARGET_DIR="${ML_ARTIFACTS_DIR:-${REPO_ROOT}/EcommerceBot.Worker/app/ml/models/artifacts}"

# Se estiver rodando com volume Docker de produção nomeado:
DOCKER_VOLUME_DIR="/var/lib/docker/volumes/prod-worker-artifacts/_data"
if [ -d "${DOCKER_VOLUME_DIR}" ] && [ ! -d "${TARGET_DIR}" ]; then
    TARGET_DIR="${DOCKER_VOLUME_DIR}"
fi

mkdir -p "${TARGET_DIR}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
START_TIME=$(date +%s)
TEMP_SYNC_DIR="/tmp/ml_artifacts_sync_${TIMESTAMP}"
mkdir -p "${TEMP_SYNC_DIR}"

send_discord_alert() {
    local status="$1"
    local message="$2"
    local color="$3"
    
    if [ -n "${DISCORD_WEBHOOK}" ]; then
        local payload=$(cat <<EOF
{
  "embeds": [
    {
      "title": "🧠 MLOps Artifacts Sync - ${status}",
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
echo -e "${CYAN}  🔄 [${TIMESTAMP}] Verificando Novos Artefatos de ML no Cloudflare R2   ${NC}"
echo -e "${CYAN}======================================================================${NC}"

SYNC_SUCCESS=false

# 1. Download do R2 via Rclone
if command -v rclone >/dev/null 2>&1; then
    echo -e "   • Verificando R2 via Rclone..."
    if rclone copy "cloudflare-r2:${R2_BUCKET}/ml-artifacts/rfm/latest/" "${TEMP_SYNC_DIR}/" --fast-list; then
        SYNC_SUCCESS=true
    fi
fi

# 2. Fallback via AWS CLI / S3 API
if [ "${SYNC_SUCCESS}" = false ] && [ -n "${R2_ACCOUNT_ID}" ] && [ "${R2_ACCOUNT_ID}" != "seu_account_id_da_cloudflare" ]; then
    ENDPOINT_URL="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
    export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
    export AWS_DEFAULT_REGION="auto"

    if command -v aws >/dev/null 2>&1; then
        echo -e "   • Fallback: Verificando R2 via AWS CLI..."
        if aws s3 sync "s3://${R2_BUCKET}/ml-artifacts/rfm/latest" "${TEMP_SYNC_DIR}" --endpoint-url "${ENDPOINT_URL}"; then
            SYNC_SUCCESS=true
        fi
    else
        echo -e "   • Fallback: Verificando R2 via Python Boto3..."
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
    paginator = s3.get_paginator('list_objects_v2')
    prefix = 'ml-artifacts/rfm/latest/'
    for page in paginator.paginate(Bucket='${R2_BUCKET}', Prefix=prefix):
        for obj in page.get('Contents', []):
            key = obj['Key']
            fname = os.path.basename(key)
            if fname:
                dest = os.path.join('${TEMP_SYNC_DIR}', fname)
                s3.download_file('${R2_BUCKET}', key, dest)
                print(f'   Downloaded {fname}')
    sys.exit(0)
except Exception as e:
    print(f'❌ Erro no download via Python: {e}', file=sys.stderr)
    sys.exit(1)
" && SYNC_SUCCESS=true || SYNC_SUCCESS=false
    fi
fi

if [ "${SYNC_SUCCESS}" = false ]; then
    echo -e "${YELLOW}⚠️ Nenhum artefato encontrado ou falha na conexão com Cloudflare R2.${NC}"
    rm -rf "${TEMP_SYNC_DIR}"
    exit 0
fi

# 3. Comparação de Hash / Modificação
MODEL_SRC="${TEMP_SYNC_DIR}/rfm_pipeline.joblib"
MODEL_DST="${TARGET_DIR}/rfm_pipeline.joblib"

HAS_CHANGES=false

if [ -f "${MODEL_SRC}" ]; then
    if [ ! -f "${MODEL_DST}" ]; then
        HAS_CHANGES=true
    else
        SRC_HASH=$(sha256sum "${MODEL_SRC}" | cut -d' ' -f1)
        DST_HASH=$(sha256sum "${MODEL_DST}" | cut -d' ' -f1)
        if [ "${SRC_HASH}" != "${DST_HASH}" ]; then
            HAS_CHANGES=true
        fi
    fi
fi

if [ "${HAS_CHANGES}" = true ]; then
    echo -e "\n${GREEN}⚡ Novo modelo detectado! Atualizando volume local de produção...${NC}"
    cp -f "${TEMP_SYNC_DIR}"/* "${TARGET_DIR}/"
    touch "${MODEL_DST}" # Atualiza mtime para trigger de hot-reload imediato no Worker

    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    echo -e "${GREEN}✅ Artefatos atualizados em ${TARGET_DIR} em ${DURATION}s.${NC}"
    echo -e "${GREEN}⚡ O Worker Python aplicará os novos pesos automaticamente no próximo request (zero downtime).${NC}"

    send_discord_alert "MODELO ATUALIZADO" "🎉 Novos artefatos de Machine Learning sincronizados na VPS!\n\n**Origem:** \`s3://${R2_BUCKET}/ml-artifacts/rfm/latest/\`\n**Destino Local:** \`${TARGET_DIR}\`\n**Hot-Reload:** Ativado automaticamente no Worker." 3066993
else
    echo -e "${YELLOW}ℹ️ Os artefatos locais já estão na versão mais recente do R2. Nenhuma alteração necessária.${NC}"
fi

rm -rf "${TEMP_SYNC_DIR}"
exit 0