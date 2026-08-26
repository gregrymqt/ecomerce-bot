#!/usr/bin/env bash
# ==============================================================================
# Script Bash de Inicialização com VENV Automático - E-commerce Bot API
# ==============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}========================================================${NC}"
echo -e "${CYAN}🚀 Inicializando E-commerce Bot API (.venv Auto-Activate)${NC}"
echo -e "${CYAN}========================================================${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

# 1. Cria o .venv caso não exista
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}📦 Criando ambiente virtual (.venv)...${NC}"
    python3 -m venv .venv || python -m venv .venv || py -3 -m venv .venv
    
    echo -e "${YELLOW}📥 Ativando .venv e instalando dependências...${NC}"
    if [ -f ".venv/bin/activate" ]; then
        source .venv/bin/activate
    elif [ -f ".venv/Scripts/activate" ]; then
        source .venv/Scripts/activate
    fi
    python -m pip install --upgrade pip
    pip install -r requirements.txt pytest pytest-asyncio pytest-cov respx
else
    echo -e "${GREEN}⚙️ Ativando ambiente virtual (.venv)...${NC}"
    if [ -f ".venv/bin/activate" ]; then
        source .venv/bin/activate
    elif [ -f ".venv/Scripts/activate" ]; then
        source .venv/Scripts/activate
    fi
fi

echo -e "${GREEN}🟢 VENV ativo. Executando API FastAPI (app.main)...${NC}"
python -m app.main
