---
name: vps-infrastructure-sre
description: "Guia canônico de engenharia de confiabilidade (SRE), provisionamento de host Linux (Ubuntu 24.04 LTS), ajustes de kernel para SQL Server, governança do Docker daemon e orçamento de memória/CPU para VPS de 6 GB / 3 vCPUs."
---

# 🖥️ VPS Infrastructure & SRE — Manual de Operação e Governança (6 GB / 3 vCPUs)

Este documento estabelece os padrões e rotinas de **Engenharia de Confiabilidade (SRE)**, **provisionamento de Sistema Operacional (Ubuntu 24.04 LTS)**, **ajustes de Kernel Linux**, **governança do Docker daemon** e **dimensionamento de recursos** para a VPS de produção do ecossistema **E-commerce Bot**.

---

## 📊 1. Topologia de Recursos e Orçamento de Memória (6 GB RAM / 3 vCPUs)

Em uma VPS de 3 slices (**6144 MB de RAM**, **3 vCPUs** e **120 GB de SSD**), nenhum serviço pode operar sem cotas rígidas (*cgroups*), evitando contenção e disparos do *Linux OOM Killer*.

### Orçamento Rígido de Memória RAM:
```text
[ RAM Total Física: 6144 MB ]
├── Host Linux + Kernel + SSH + Docker Daemon : ~700 MB
├── Contêineres da Aplicação (cgroup limits)   : ~4864 MB
│    ├── SQL Server 2022 (mssql)              : 2800 MB (Buffer Pool max server memory = 2200 MB)
│    ├── Core API .NET 9 (api)                :  768 MB
│    ├── Python Worker ML/Scraper (worker)    :  512 MB
│    ├── RabbitMQ Message Broker (rabbitmq)   :  384 MB
│    ├── Redis Cache & Pub/Sub (redis)        :  256 MB (maxmemory = 192 MB)
│    ├── Nginx Reverse Proxy (reverse-proxy)  :  128 MB
│    └── Certbot SSL (certbot)                :   64 MB
└── Margem Livre / Page Cache do Linux        : ~580 MB
└── Swapfile de Emergência em Disco (NVMe/SSD): 4096 MB (4 GB)
```

---

## 🐧 2. Ajustes de Kernel Linux (/etc/sysctl.d/99-mssql.conf)

O comportamento padrão do Linux de paginação e dirty pages entra em conflito direto com o Buffer Pool do SQL Server. Os seguintes parâmetros devem estar ativos:

```ini
# Reduz a propensão do kernel de paginar processos para a swap (prioriza RAM)
vm.swappiness = 1

# Força o kernel a iniciar escritas assíncronas em disco cedo, evitando picos de I/O
vm.dirty_background_ratio = 3
vm.dirty_ratio = 80

# Granularidade do escalonador de CPU para threads de alta performance
kernel.sched_min_granularity_ns = 15000000
kernel.sched_wakeup_granularity_ns = 2000000

# Limite global de descritores de arquivo abertos no sistema
fs.file-max = 2097152
```

Para aplicar sem reiniciar o servidor:
```bash
sudo sysctl --system
```

---

## 🔒 3. Limites de Recursos e Descritores (/etc/security/limits.d/99-mssql.conf)

Para evitar erros de `Too many open files` sob concorrência intensa de conexões TCP, túneis SSH e pools ADO.NET:

```ini
*          soft    nofile     65536
*          hard    nofile     65536
root       soft    nofile     65536
root       hard    nofile     65536
```

---

## 🛡️ 4. Segurança de Rede e Firewall Host (UFW)

A porta `1433` do SQL Server e `15672` do RabbitMQ **NUNCA** devem ser expostas diretamente à internet pública.

### Configuração Padrão do Firewall:
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP Nginx'
sudo ufw allow 443/tcp comment 'HTTPS Nginx'
sudo ufw enable
```

> [!CAUTION]
> O Docker manipula diretamente o `iptables`. Serviços mapeados como `0.0.0.0:1433:1433` furam o UFW caso o bind não seja feito explicitamente em `127.0.0.1:1433:1433`.

---

## 🐳 5. Governança do Docker Daemon & Armazenamento (120 GB SSD)

Em servidores com disco único de 120 GB, logs de contêineres e imagens antigas de deploys contínuos são os principais causadores de esgotamento de disco.

### 1. Rotação Estrita de Logs (/etc/docker/daemon.json):
```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
```

### 2. Automação de Limpeza com Cron do Host:
Entrada semanal no crontab (`sudo crontab -e`) para purgar imagens e volumes órfãos:
```bash
# Poda imagens órfãs semanalmente todo domingo às 03:00 UTC
0 3 * * 0 /usr/bin/docker image prune -af --filter "until=168h" > /dev/null 2>&1
```

---

## ⚡ 6. Calibração do Motor SQL Server para 3 vCPUs

Com 3 vCPUs na VPS, o paralelismo e o `tempdb` devem ser calibrados para evitar sobrecarga de contexto:

```sql
EXEC sp_configure 'show advanced options', 1;
RECONFIGURE;
GO

-- Limite máximo do buffer pool (2200 MB de buffer + 600 MB headroom = 2800 MB cgroup)
EXEC sp_configure 'max server memory (MB)', 2200;

-- Paralelismo restrito a 2 núcleos para deixar 1 vCPU dedicada ao SO/Nginx/API
EXEC sp_configure 'max degree of parallelism', 2;

-- Compila planos paralelos apenas para queries realmente pesadas
EXEC sp_configure 'cost threshold for parallelism', 50;

RECONFIGURE;
GO
```

### Dimensionamento do tempdb para 3 vCPUs:
- Exatamente **3 arquivos de dados idênticos** (`tempdev`, `tempdev2`, `tempdev3`).
- Alocados no volume isolado `/var/opt/mssql/tempdb/`.
- `SIZE = 256MB, FILEGROWTH = 64MB, MAXSIZE = 2048MB`.

---

## 🚀 7. Script de Provisionamento Automático (Day-Zero Host)

O ecossistema dispõe de um script idempotente em [infra/prod/scripts/provision_vps_host.sh](file:///c:/Users/digob/Desktop/ecommerce-bot/infra/prod/scripts/provision_vps_host.sh) que automatiza toda a configuração do sistema operacional:
- Criação e ativação da Swapfile de 4 GB.
- Injeção das configurações de kernel e limits.
- Configuração do daemon do Docker e reinicialização segura.
- Regras de firewall UFW e agendamento da limpeza semanal no cron.
