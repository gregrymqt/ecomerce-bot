#!/usr/bin/env bash

# ==============================================================================
# Script de Provisionamento e Hardening de Host VPS (Ubuntu 24.04 LTS)
# E-commerce Bot SaaS — Infraestrutura SRE (6 GB RAM / 3 vCPUs / 120 GB SSD)
# ==============================================================================
# Execução (como root ou com sudo):
# chmod +x infra/prod/scripts/provision_vps_host.sh
# sudo ./infra/prod/scripts/provision_vps_host.sh
# ==============================================================================

set -eo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}======================================================================${NC}"
echo -e "${CYAN}  🚀 Provisionamento e Hardening de Host VPS — E-commerce Bot SaaS     ${NC}"
echo -e "${CYAN}  Especificação: Ubuntu 24.04 LTS | 6 GB RAM | 3 vCPUs | 120 GB SSD  ${NC}"
echo -e "${CYAN}======================================================================${NC}"

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Este script deve ser executado como root ou via sudo.${NC}"
    exit 1
fi

# 1. Ajustes de Kernel Linux para SQL Server 2022 (/etc/sysctl.d/99-mssql.conf)
echo -e "\n${YELLOW}⚙️ [1/6] Aplicando parâmetros de Kernel Linux...${NC}"
cat <<'EOF' > /etc/sysctl.d/99-mssql.conf
# E-commerce Bot — Otimização de Kernel para SQL Server em VPS de 6 GB
# Reduz propensão de paginação para Swap (prioriza Buffer Pool na RAM)
vm.swappiness = 1

# Gravações assíncronas em disco começam cedo para mitigar picos de I/O
vm.dirty_background_ratio = 3
vm.dirty_ratio = 80

# Granularidade do scheduler de CPU para threads do SQL Server e .NET
kernel.sched_min_granularity_ns = 15000000
kernel.sched_wakeup_granularity_ns = 2000000

# Limite global de descritores de arquivos abertos no sistema
fs.file-max = 2097152
EOF

sysctl --system > /dev/null 2>&1
echo -e "${GREEN}✅ Parâmetros de Kernel aplicados com sucesso!${NC}"

# 2. Limites de Recursos e Descritores (/etc/security/limits.d/99-mssql.conf)
echo -e "\n${YELLOW}🔒 [2/6] Configurando limites de descritores de arquivos (nofile 65536)...${NC}"
cat <<'EOF' > /etc/security/limits.d/99-mssql.conf
# Limites de descritores de arquivos abertos para SQL Server e Containers
*          soft    nofile     65536
*          hard    nofile     65536
root       soft    nofile     65536
root       hard    nofile     65536
EOF
echo -e "${GREEN}✅ Limites de nofile configurados!${NC}"

# 3. Criação de Swapfile de Emergência (4 GB)
echo -e "\n${YELLOW}💾 [3/6] Verificando/Criando Swapfile de 4 GB...${NC}"
if [ ! -f /swapfile ]; then
    echo -e "   • Alocando 4 GB em /swapfile..."
    fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
    chmod 600 /swapfile
    mkswap /swapfile > /dev/null
    swapon /swapfile
    if ! grep -q '/swapfile' /etc/fstab; then
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
    fi
    echo -e "${GREEN}✅ Swapfile de 4 GB criada e ativada com sucesso!${NC}"
else
    echo -e "${GREEN}ℹ️ Swapfile já existe. Garantindo ativação...${NC}"
    swapon /swapfile 2>/dev/null || true
fi

# 4. Firewall do Host (UFW)
echo -e "\n${YELLOW}🛡️ [4/6] Configurando Firewall UFW (SSH, HTTP, HTTPS)...${NC}"
if command -v ufw > /dev/null 2>&1; then
    ufw default deny incoming > /dev/null
    ufw default allow outgoing > /dev/null
    ufw allow 22/tcp comment 'SSH' > /dev/null
    ufw allow 80/tcp comment 'HTTP Nginx' > /dev/null
    ufw allow 443/tcp comment 'HTTPS Nginx' > /dev/null
    ufw --force enable > /dev/null
    echo -e "${GREEN}✅ Firewall UFW ativo e configurado com menor privilégio!${NC}"
else
    echo -e "${YELLOW}⚠️ UFW não encontrado. Instale com 'apt install ufw' para proteger o host.${NC}"
fi

# 5. Governança do Docker Daemon (/etc/docker/daemon.json)
echo -e "\n${YELLOW}🐳 [5/6] Configurando rotação estrita de logs no Docker Daemon...${NC}"
mkdir -p /etc/docker

# Cria ou atualiza daemon.json com rotação de log
cat <<'EOF' > /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
EOF

if systemctl is-active --quiet docker; then
    echo -e "   • Reiniciando serviço Docker para aplicar rotação de logs..."
    systemctl restart docker
fi
echo -e "${GREEN}✅ Docker Daemon configurado com teto de 150 MB de logs por container!${NC}"

# 6. Agendamento de Limpeza Automática no Cron (/etc/cron.d/docker-prune)
echo -e "\n${YELLOW}🧹 [6/6] Agendando rotina semanal de limpeza de imagens órfãs no Docker...${NC}"
cat <<'EOF' > /etc/cron.d/docker-prune
# Limpeza semanal de imagens e volumes órfãos com mais de 7 dias (Domingos às 03:00 UTC)
0 3 * * 0 root /usr/bin/docker image prune -af --filter "until=168h" > /dev/null 2>&1
EOF
chmod 644 /etc/cron.d/docker-prune
echo -e "${GREEN}✅ Cron job de housekeeping registrado em /etc/cron.d/docker-prune!${NC}"

echo -e "\n${GREEN}🎉 Provisionamento do Host VPS finalizado com 100% de sucesso!${NC}"
echo -e "${CYAN}Próximos passos: Iniciar a stack com 'docker compose -f infra/prod/docker-compose.prod.yml up -d'${NC}"
