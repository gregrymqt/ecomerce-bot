# 🚀 Guia de Deploy, Infraestrutura e Operações — E-commerce Bot

Este documento orienta o processo de deploy, configuração de ambiente local e produção com **Docker Compose**, rotinas de manutenção do **Microsoft SQL Server 2022**, automação de backups no **Cloudflare R2** e testes de recuperação de desastres (*Disaster Recovery*).

---

## 🏗️ 1. Ambientes & Orquestração Docker

O projeto possui dois ambientes padronizados na pasta [`infra/`](file:///c:/Users/digob/Desktop/ecommerce-bot/infra):

```
infra/
├── dev/                     # Ambiente de Desenvolvimento Local
│   ├── docker-compose.dev.yml
│   └── .env.dev.example
│
└── prod/                    # Ambiente de Produção (VPS Linux / Cloud)
    ├── docker-compose.prod.yml
    ├── .env.prod.example
    ├── nginx/               # Nginx com SSL e suporte a SSE
    │   └── default.conf
    └── scripts/             # Scripts de Manutenção e Backup
        ├── backup_sqlserver_r2.sh
        ├── restore_sqlserver_test.sh
        └── setup_sqlserver_maintenance.sh
```

---

## 💻 2. Inicialização em Desenvolvimento Local

### Pré-requisitos:
- Docker & Docker Compose
- .NET 9 SDK (para o Core) e .NET 8 SDK (para o Runner de Migrações)
- Python 3.13
- Node.js 20+

### Passo a Passo:
1. **Subir os serviços de infraestrutura (Banco, Redis e RabbitMQ):**
   ```bash
   cd infra/dev
   cp .env.dev.example .env.dev
   docker compose -f docker-compose.dev.yml up -d
   ```

2. **Executar as Migrações do Banco de Dados:**
   ```bash
   dotnet run --project Database.Migrations/Database.Migrations.csproj
   ```

3. **Iniciar o Backend Central (.NET):**
   ```bash
   dotnet run --project EcommerceBot.Core/src/EcommerceBot.Api/EcommerceBot.Api.csproj
   ```

4. **Iniciar o AI/ML Worker (Python):**
   ```bash
   cd EcommerceBot.Worker
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

5. **Iniciar o Frontend Web (React):**
   ```bash
   cd EcommerceBot.Web
   npm install
   npm run dev
   ```

---

## 🌐 3. Configuração de Nginx em Produção (Suporte a SSE)

Para garantir que o fluxo de **Server-Sent Events (SSE)** em `/api/v1/stream` funcione em tempo real sem atrasos ou *buffering*, a configuração do Nginx inclui:

```nginx
location /api/v1/stream {
    proxy_pass http://ecommercebot_core:5000;
    proxy_set_header Connection '';
    proxy_http_version 1.1;
    chunked_transfer_encoding off;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 24h;
}
```

---

## 💾 4. Backup Resiliente do SQL Server no Cloudflare R2

O script [`backup_sqlserver_r2.sh`](file:///c:/Users/digob/Desktop/ecommerce-bot/infra/prod/scripts/backup_sqlserver_r2.sh) realiza snapshots diários comprimidos e os sincroniza com um bucket S3/R2 seguro:

### Fluxo de Execução do Script:
1. **Geração do Backup T-SQL Nativo com Compressão:**
   ```sql
   BACKUP DATABASE [EcommerceBotDb] 
   TO DISK = N'/var/opt/mssql/backup/EcommerceBotDb_20260828.bak' 
   WITH COMPRESSION, CHECKSUM, INIT;
   ```
2. **Sincronização com Cloudflare R2 via Rclone / AWS CLI:**
   Envia o `.bak` diretamente para o bucket com criptografia em trânsito.
3. **Notificação de Sucesso/Falha no Discord:**
   Dispara um embed verde com o tamanho do arquivo e tempo de execução, ou um alerta vermelho em caso de erro.
4. **Limpeza de Retenção Local:**
   Remove backups locais mais antigos que 7 dias para poupar disco da VPS.

### Agendamento via Cron na VPS:
```bash
# Executa o backup diário todos os dias às 03:00 da manhã
0 3 * * * /app/infra/prod/scripts/backup_sqlserver_r2.sh >> /var/log/backup_sqlserver.log 2>&1
```

---

## 🔄 5. Teste de Restauração e Validação de Integridade

O script [`restore_sqlserver_test.sh`](file:///c:/Users/digob/Desktop/ecommerce-bot/infra/prod/scripts/restore_sqlserver_test.sh) valida se os backups do Cloudflare R2 estão íntegros subindo um container temporário e executando o `DBCC CHECKDB`:

```bash
./infra/prod/scripts/restore_sqlserver_test.sh
```

> **Regra de Ouro:** Um backup só existe se a sua rotina de restauração foi testada e aprovada com sucesso.
