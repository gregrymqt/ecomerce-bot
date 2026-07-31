#!/usr/bin/env bash
# ==============================================================================
# Script de Hardening e Segurança para VPS Linux (Ubuntu/Debian)
# ==============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🛡️ Iniciando Hardening da VPS InterServer...${NC}"

# 1. Atualiza os pacotes do sistema
sudo apt update && sudo apt upgrade -y
sudo apt install -y ufw fail2ban curl git

# 2. Configuração do UFW Firewall
echo -e "${YELLOW}🔒 Configurando UFW Firewall...${NC}"
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 22/tcp    # SSH (Altere se utilizar porta customizada)
echo "y" | sudo ufw enable

# 3. Configuração do Fail2ban (Proteção contra Brute Force SSH)
echo -e "${YELLOW}🛡️ Ativando Fail2ban...${NC}"
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# 4. Ajustes Recomendados no SSH (/etc/ssh/sshd_config)
echo -e "${GREEN}✅ Firewall e Fail2ban configurados com sucesso!${NC}"
echo -e "${YELLOW}⚠️ DICA DE SEGURANÇA SSH (Manual):${NC}"
echo "Certifique-se de desativar o login por senha e permitir apenas chave pública em '/etc/ssh/sshd_config':"
echo "  - PermitRootLogin prohibit-password"
echo "  - PasswordAuthentication no"