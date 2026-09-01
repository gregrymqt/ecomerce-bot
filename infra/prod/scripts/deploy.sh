#!/usr/bin/env bash

# ==============================================================================
# Script de Deploy Automatizado para Produção (VPS InterServer) - E-commerce Bot
# Ecossistema: SQL Server 2022 + DbUp (.NET 9) + React 18 + RabbitMQ + Redis
# ==============================================================================

set -eo pipefail

GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'
RED='\033[0;31m'
YELLOW='\033[1;33m'

echo -e "${CYAN}======================================================================${NC}"
echo -e "${CYAN}  🚀 Iniciando processo de deploy na VPS — E-commerce Bot SaaS        ${NC}"
echo -e "${CYAN}======================================================================${NC}"

# 1. Navega até a raiz do repositório
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
cd "${REPO_ROOT}"

echo -e "${YELLOW}📍 Diretório do repositório: ${REPO_ROOT}${NC}"

# 2. Atualiza o repositório Git se estiver em ambiente Git
if [ -d ".git" ]; then
    echo -e "${GREEN}📥 Atualizando código-fonte via Git pull...${NC}"
    git pull origin main || git pull origin master || true
fi

# 3. Verifica se o arquivo de variáveis de ambiente de produção existe
ENV_PROD_PATH="${REPO_ROOT}/infra/prod/.env.prod"
COMPOSE_FILE="${REPO_ROOT}/infra/prod/docker-compose.prod.yml"

if [ ! -f "${ENV_PROD_PATH}" ]; then
    if [ -f "${REPO_ROOT}/.env" ]; then
        echo -e "${YELLOW}⚠️ Aviso: '${ENV_PROD_PATH}' não encontrado. Utilizando '${REPO_ROOT}/.env' como fallback.${NC}"
        ENV_PROD_PATH="${REPO_ROOT}/.env"
    else
        echo -e "${RED}❌ ERRO: Nem '${ENV_PROD_PATH}' nem '${REPO_ROOT}/.env' foram encontrados!${NC}"
        echo -e "${YELLOW}💡 Copie '${REPO_ROOT}/infra/prod/.env.prod.example' para '${ENV_PROD_PATH}' e configure as credenciais antes de rodar o deploy.${NC}"
        exit 1
    fi
fi

# 4. Inicializa os serviços de infraestrutura base (MSSQL, Redis, RabbitMQ)
echo -e "\n${YELLOW}🏗️ [1/3] Inicializando banco de dados e mensageria base...${NC}"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_PROD_PATH}" up -d mssql redis rabbitmq

# 5. Executa as migrações determinísticas do banco de dados (DbUp .NET)
echo -e "\n${YELLOW}🔄 [2/3] Executando migrações SQL Server 2022 (Database.Migrations com DbUp)...${NC}"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_PROD_PATH}" run --rm migrations || {
    echo -e "${RED}❌ ERRO: Falha ao executar as migrações do banco de dados.${NC}"
    exit 1
}

# 6. Compila imagens e inicia todos os serviços da aplicação
echo -e "\n${YELLOW}🚀 [3/3] Compilando imagens e reiniciando a stack produtiva...${NC}"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_PROD_PATH}" up -d --build --remove-orphans

# 7. Exibe status e integridade dos contêineres
echo -e "\n${GREEN}✅ Deploy concluído com sucesso! Status dos serviços:${NC}"
docker compose -f "${COMPOSE_FILE}" ps

echo -e "\n${CYAN}======================================================================${NC}"
echo -e "${GREEN}🎉 Ecossistema E-commerce Bot 100% operacional na VPS!               ${NC}"
echo -e "${CYAN}======================================================================${NC}"
