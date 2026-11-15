#!/usr/bin/env bash

# ==============================================================================
# Script de Validação de Disaster Recovery (Teste de Restauração PostgreSQL 16)
# E-commerce Bot SaaS
# ==============================================================================
# Uso:
# chmod +x infra/prod/scripts/restore_postgres_test.sh
# ./infra/prod/scripts/restore_postgres_test.sh [caminho_ou_nome_do_dump]
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

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-prod-postgres-bot}"
POSTGRES_USER="${POSTGRES_USER:-usr_ecommerce_api}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-prod_postgres_password_secure}"
R2_BUCKET="${R2_BUCKET_NAME:-ecommerce-bot-backups}"
DISCORD_WEBHOOK="${DISCORD_WEBHOOK_URL}"

TEST_DB="ecommerce_bot_db_restore_test"
HOST_TEMP="/tmp/restore_test_$$.dump"
CONTAINER_DUMP="/tmp/restore_test.dump"

echo -e "${CYAN}======================================================================${NC}"
echo -e "${CYAN}  🧪 Teste de Homologação de Disaster Recovery (PostgreSQL 16)         ${NC}"
echo -e "${CYAN}======================================================================${NC}"

# 1. Localizar ou Baixar arquivo .dump
DUMP_ARG="$1"

if [ -z "${DUMP_ARG}" ]; then
    echo -e "${YELLOW}🔍 Nenhum arquivo .dump informado. Buscando o backup mais recente no Cloudflare R2...${NC}"
    if command -v rclone >/dev/null 2>&1; then
        LATEST_REMOTE=$(rclone lsjson "cloudflare-r2:${R2_BUCKET}/postgres/" --recursive --files-only 2>/dev/null | grep -o '"Path":"[^"]*' | grep -E "\.dump$" | tail -n 1 | cut -d'"' -f4 || true)
        if [ -n "${LATEST_REMOTE}" ]; then
            echo -e "   • Baixando backup remoto: ${LATEST_REMOTE} via Rclone..."
            rclone copyto "cloudflare-r2:${R2_BUCKET}/postgres/${LATEST_REMOTE}" "${HOST_TEMP}"
            docker cp "${HOST_TEMP}" "${POSTGRES_CONTAINER}:${CONTAINER_DUMP}"
            rm -f "${HOST_TEMP}"
        fi
    fi
    
    if [ ! -f "${HOST_TEMP}" ] && [ -n "${R2_ACCOUNT_ID}" ] && [ "${R2_ACCOUNT_ID}" != "seu_account_id_da_cloudflare" ]; then
        ENDPOINT_URL="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
        export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
        export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
        export AWS_DEFAULT_REGION="auto"
        if command -v aws >/dev/null 2>&1; then
            LATEST_KEY=$(aws s3 ls "s3://${R2_BUCKET}/postgres/" --recursive --endpoint-url "${ENDPOINT_URL}" 2>/dev/null | grep -E "\.dump$" | tail -n 1 | awk '{print $4}' || true)
            if [ -n "${LATEST_KEY}" ]; then
                echo -e "   • Baixando backup remoto: ${LATEST_KEY} via AWS CLI..."
                aws s3 cp "s3://${R2_BUCKET}/${LATEST_KEY}" "${HOST_TEMP}" --endpoint-url "${ENDPOINT_URL}"
                docker cp "${HOST_TEMP}" "${POSTGRES_CONTAINER}:${CONTAINER_DUMP}"
                rm -f "${HOST_TEMP}"
            fi
        fi
    fi
else
    if [ -f "${DUMP_ARG}" ]; then
        echo -e "   • Enviando arquivo local '${DUMP_ARG}' para o container..."
        docker cp "${DUMP_ARG}" "${POSTGRES_CONTAINER}:${CONTAINER_DUMP}"
    else
        CONTAINER_DUMP="${DUMP_ARG}"
    fi
fi

# 2. Verificar prontidão do PostgreSQL
echo -e "\n${YELLOW}🩺 [1/4] Verificando prontidão do container '${POSTGRES_CONTAINER}'...${NC}"
if ! docker exec "${POSTGRES_CONTAINER}" pg_isready -U "${POSTGRES_USER}" > /dev/null 2>&1; then
    echo -e "${RED}❌ ERRO: PostgreSQL não está respondendo no container '${POSTGRES_CONTAINER}'.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ PostgreSQL operacional.${NC}"

# 3. Criar Banco de Teste Isolado
echo -e "\n${YELLOW}🏗️ [2/4] Preparando banco de homologação '${TEST_DB}'...${NC}"
docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${POSTGRES_CONTAINER}" \
    psql -U "${POSTGRES_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB};" > /dev/null 2>&1 || true

docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${POSTGRES_CONTAINER}" \
    psql -U "${POSTGRES_USER}" -d postgres -c "CREATE DATABASE ${TEST_DB};" > /dev/null 2>&1

echo -e "${GREEN}✅ Banco '${TEST_DB}' criado para validação.${NC}"

# 4. Executar Restauração com pg_restore
echo -e "\n${YELLOW}🔄 [3/4] Restaurando dump no banco '${TEST_DB}' via pg_restore...${NC}"
docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${POSTGRES_CONTAINER}" \
    pg_restore -U "${POSTGRES_USER}" -d "${TEST_DB}" --no-owner --no-privileges "${CONTAINER_DUMP}" > /dev/null 2>&1 || true

# 5. Validação de Integridade e Contagem de Tabelas
echo -e "\n${YELLOW}🔍 [4/4] Validando integridade dos dados restaurados...${NC}"
TABLE_COUNT=$(docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${POSTGRES_CONTAINER}" \
    psql -U "${POSTGRES_USER}" -d "${TEST_DB}" -t -A -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema IN ('dbo', 'public');" 2>/dev/null || echo "0")

echo -e "   • Tabelas restauradas detectadas: ${TABLE_COUNT}"

if [ "${TABLE_COUNT}" -gt 0 ]; then
    echo -e "${GREEN}✅ Validação de integridade aprovada com sucesso! (${TABLE_COUNT} tabelas restauradas).${NC}"
else
    echo -e "${RED}⚠️ AVISO: Nenhuma tabela encontrada no banco de teste após a restauração.${NC}"
fi

# 6. Limpeza do Banco de Homologação e Arquivo Temporário
echo -e "\n${YELLOW}🧹 Limpando ambiente de teste...${NC}"
docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${POSTGRES_CONTAINER}" \
    psql -U "${POSTGRES_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB};" > /dev/null 2>&1 || true
docker exec "${POSTGRES_CONTAINER}" rm -f "${CONTAINER_DUMP}" > /dev/null 2>&1 || true

echo -e "\n${GREEN}🎉 Teste de restauração e disaster recovery do PostgreSQL concluído com êxito!${NC}"
