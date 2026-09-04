#!/usr/bin/env bash

# ==============================================================================
# Script de Upload de Artefatos de ML (Spark RFM) para Cloudflare R2 (S3 API)
# E-commerce Bot SaaS - MLOps Pipeline
# ==============================================================================
# Uso:
#   chmod +x infra/prod/scripts/upload_ml_artifacts_r2.sh
#   ./infra/prod/scripts/upload_ml_artifacts_r2.sh
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

R2_BUCKET="${R2_BUCKET_NAME:-ecommerce-bot-backups}"
DISCORD_WEBHOOK="${DISCORD_WEBHOOK_URL}"
ARTIFACTS_DIR="${REPO_ROOT}/EcommerceBot.Worker/app/ml/models/artifacts"
REPORTS_DIR="${REPO_ROOT}/docs/notebooklm/reports"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
START_TIME=$(date +%s)

send_discord_alert() {
    local status="$1"
    local message="$2"
    local color="$3"
    
    if [ -n "${DISCORD_WEBHOOK}" ]; then
        local payload=$(cat <<EOF
{
  "embeds": [
    {
      "title": "🧠 MLOps Artifacts Upload - ${status}",
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
echo -e "${CYAN}  🚀 [${TIMESTAMP}] Enviando Artefatos de ML para o Cloudflare R2      ${NC}"
echo -e "${CYAN}======================================================================${NC}"

if [ ! -d "${ARTIFACTS_DIR}" ]; then
    echo -e "${RED}❌ ERRO: Diretório de artefatos não encontrado: ${ARTIFACTS_DIR}${NC}"
    exit 1
fi

MODEL_FILE="${ARTIFACTS_DIR}/rfm_pipeline.joblib"
META_FILE="${ARTIFACTS_DIR}/rfm_pipeline_metadata.json"
REPORT_FILE="${REPORTS_DIR}/latest_metrics_report.md"

if [ ! -f "${MODEL_FILE}" ]; then
    echo -e "${RED}❌ ERRO: Arquivo do modelo não encontrado: ${MODEL_FILE}${NC}"
    echo -e "${YELLOW}💡 Dica: Execute o job Spark antes: python -m app.ml.spark.run_batch${NC}"
    exit 1
fi

TEMP_STAGING="/tmp/ml_artifacts_upload_${TIMESTAMP}"
mkdir -p "${TEMP_STAGING}"

cp -f "${MODEL_FILE}" "${TEMP_STAGING}/"
[ -f "${META_FILE}" ] && cp -f "${META_FILE}" "${TEMP_STAGING}/"
[ -f "${REPORT_FILE}" ] && cp -f "${REPORT_FILE}" "${TEMP_STAGING}/"

TOTAL_SIZE=$(du -sh "${TEMP_STAGING}" | cut -f1)
echo -e "${GREEN}📦 Arquivos preparados para upload (${TOTAL_SIZE})${NC}"

UPLOAD_SUCCESS=false

# 1. Tentativa via Rclone
if command -v rclone >/dev/null 2>&1; then
    echo -e "   • Utilizando Rclone para sincronizar com Cloudflare R2..."
    if rclone copy "${TEMP_STAGING}/" "cloudflare-r2:${R2_BUCKET}/ml-artifacts/rfm/${TIMESTAMP}/" --fast-list && \
       rclone copy "${TEMP_STAGING}/" "cloudflare-r2:${R2_BUCKET}/ml-artifacts/rfm/latest/" --fast-list; then
        UPLOAD_SUCCESS=true
        echo -e "${GREEN}✅ Artefatos enviados para o R2 com sucesso via Rclone!${NC}"
    fi
fi

# 2. Fallback via AWS CLI / S3 API
if [ "${UPLOAD_SUCCESS}" = false ] && [ -n "${R2_ACCOUNT_ID}" ] && [ "${R2_ACCOUNT_ID}" != "seu_account_id_da_cloudflare" ]; then
    ENDPOINT_URL="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
    export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
    export AWS_DEFAULT_REGION="auto"

    if command -v aws >/dev/null 2>&1; then
        echo -e "   • Fallback: Utilizando AWS CLI para envio ao Cloudflare R2..."
        if aws s3 sync "${TEMP_STAGING}" "s3://${R2_BUCKET}/ml-artifacts/rfm/${TIMESTAMP}" --endpoint-url "${ENDPOINT_URL}" && \
           aws s3 sync "${TEMP_STAGING}" "s3://${R2_BUCKET}/ml-artifacts/rfm/latest" --endpoint-url "${ENDPOINT_URL}"; then
            UPLOAD_SUCCESS=true
            echo -e "${GREEN}✅ Artefatos enviados para o R2 com sucesso via AWS CLI!${NC}"
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
    for fname in os.listdir('${TEMP_STAGING}'):
        fpath = os.path.join('${TEMP_STAGING}', fname)
        if os.path.isfile(fpath):
            s3.upload_file(fpath, '${R2_BUCKET}', f'ml-artifacts/rfm/${TIMESTAMP}/{fname}')
            s3.upload_file(fpath, '${R2_BUCKET}', f'ml-artifacts/rfm/latest/{fname}')
            print(f'   Uploaded {fname}')
    sys.exit(0)
except Exception as e:
    print(f'❌ Erro no upload via Python: {e}', file=sys.stderr)
    sys.exit(1)
" && UPLOAD_SUCCESS=true || UPLOAD_SUCCESS=false
    fi
fi

rm -rf "${TEMP_STAGING}"

if [ "${UPLOAD_SUCCESS}" = false ]; then
    echo -e "${RED}❌ ERRO: Falha em todos os métodos de upload para o Cloudflare R2.${NC}"
    send_discord_alert "FALHA NO UPLOAD R2" "❌ Falha ao sincronizar artefatos de ML com o Cloudflare R2." 15158332
    exit 1
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo -e "\n${GREEN}🎉 Upload concluído com sucesso em ${DURATION}s!${NC}"
echo -e "   • Histórico: s3://${R2_BUCKET}/ml-artifacts/rfm/${TIMESTAMP}/"
echo -e "   • Produção:  s3://${R2_BUCKET}/ml-artifacts/rfm/latest/\n"

send_discord_alert "SUCESSO" "✅ Novos modelos de ML (.joblib + metadados) enviados para o Cloudflare R2.\n\n**Destino:** \`s3://${R2_BUCKET}/ml-artifacts/rfm/latest/\`\n**Duração:** ${DURATION}s" 3066993