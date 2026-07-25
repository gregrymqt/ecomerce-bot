#!/usr/bin/env bash

# ==============================================================================
# Script de Deploy Automatizado para Produção (VPS InterServer) - E-commerce Bot
# ==============================================================================

set -e

GREEN='\033[0;32m'
NC='\033[0m'
RED='\033[0;31m'
YELLOW='\033[1;33m'

echo -e "${GREEN}🚀 Iniciando processo de deploy na VPS InterServer...${NC}"

# 1. Navega até a raiz do repositório
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
cd "${REPO_ROOT}"

echo -e "${YELLOW}📍 Diretório do repositório: ${REPO_ROOT}${NC}"

# 2. Atualiza o repositório Git se estiver em ambiente Git
if [ -d ".git" ]; then
    echo -e "${GREEN}📥 Atualizando código-fonte via Git pull...${NC}"
    git pull origin main || git pull origin master
fi

# 3. Verifica se o arquivo de variáveis de ambiente de produção existe
ENV_PROD_PATH="${REPO_ROOT}/infra/prod/.env.prod"

if [ ! -f "${ENV_PROD_PATH}" ]; then
    echo -e "${RED}❌ ERRO: O arquivo '${ENV_PROD_PATH}' não foi encontrado!${NC}"
    echo -e "${YELLOW}💡 Copie '${REPO_ROOT}/infra/prod/.env.prod.example' para '${ENV_PROD_PATH}' e configure as credenciais da nuvem antes de rodar o deploy.${NC}"
    exit 1
fi

# 4. Executa Build e levanta contêineres em background
echo -e "${GREEN}🏗️ Compilando imagens Docker e reiniciando contêineres...${NC}"
docker compose -f infra/prod/docker-compose.prod.yml --env-file infra/prod/.env.prod up -d --build --remove-orphans

# 5. Aplica migrations do banco de dados relacional (Alembic) dentro do contêiner da API
echo -e "${GREEN}🔄 Executando migrations do banco de dados (Alembic)...${NC}"
docker compose -f infra/prod/docker-compose.prod.yml exec -T api alembic upgrade head || {
    echo -e "${YELLOW}⚠️ Aviso: Migrations falharam ou já estavam atualizadas.${NC}"
}

# 6. Exibe status dos contêineres
echo -e "${GREEN}✅ Deploy concluído com sucesso! Status dos serviços:${NC}"
docker compose -f infra/prod/docker-compose.prod.yml ps

echo -e "${GREEN}🎉 Aplicação E-commerce Bot rodando na VPS InterServer!${NC}"
