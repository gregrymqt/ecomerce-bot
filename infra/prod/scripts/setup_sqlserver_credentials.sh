#!/usr/bin/env bash

# ==============================================================================
# Script de Provisionamento de Credenciais Segregadas (Day-Zero)
# E-commerce Bot SaaS — Hardening de Segurança (Princípio do Menor Privilégio)
# ==============================================================================
# Uso:
# chmod +x infra/prod/scripts/setup_sqlserver_credentials.sh
# ./infra/prod/scripts/setup_sqlserver_credentials.sh
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
MSSQL_DEPLOYER_PASSWORD="${MSSQL_DEPLOYER_PASSWORD:-Deployer@Secure_Passw0rd_Prod2026!}"
MSSQL_API_PASSWORD="${MSSQL_API_PASSWORD:-Api@Secure_Passw0rd_Prod2026!}"

echo -e "${CYAN}======================================================================${NC}"
echo -e "${CYAN}  🔒 Provisionamento de Logins & Credenciais Segregadas (SQL Server)   ${NC}"
echo -e "${CYAN}======================================================================${NC}"

# Aguardar disponibilidade do SQL Server
until docker exec "${MSSQL_CONTAINER}" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -C -Q "SELECT 1" > /dev/null 2>&1; do
    echo -e "   • Aguardando SQL Server responder..."
    sleep 2
done

echo -e "${YELLOW}>> Aplicando segregação de logins (usr_ecommerce_deployer e usr_ecommerce_api)...${NC}"
docker exec -i "${MSSQL_CONTAINER}" /opt/mssql-tools18/bin/sqlcmd \
    -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -C \
    -v MSSQL_DEPLOYER_PASSWORD="${MSSQL_DEPLOYER_PASSWORD}" \
    -v MSSQL_API_PASSWORD="${MSSQL_API_PASSWORD}" \
    -i /tmp/setup_sqlserver_credentials.sql 2>/dev/null || \
docker exec -i "${MSSQL_CONTAINER}" /opt/mssql-tools18/bin/sqlcmd \
    -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -C \
    -v MSSQL_DEPLOYER_PASSWORD="${MSSQL_DEPLOYER_PASSWORD}" \
    -v MSSQL_API_PASSWORD="${MSSQL_API_PASSWORD}" \
    < "${SCRIPT_DIR}/setup_sqlserver_credentials.sql"

echo -e "${GREEN}🎉 Credenciais segregadas provisionadas com sucesso!${NC}"
