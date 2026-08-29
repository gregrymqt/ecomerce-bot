# 🚀 Guia Mestre de Execução & Inicialização — E-commerce Bot

Este documento estabelece o pipeline determinístico e a ordem cronológica estrita para inicializar o ecossistema (Containers, Migrações, Core API, Worker IA e Frontend).

---

## 💻 PARTE 1: Desenvolvimento Local (Fluxo Diário)

Para rodar todo o sistema na sua máquina, siga rigorosamente os **5 passos na sequência**:

[1. Docker Dev] ──► [2. DbUp Migrations] ──► [3. Core API .NET] ──► [4. Worker Python] ──► [5. Web React]


---

### Passo 1: Subir os Containers de Infraestrutura (Terminal 1)
O SQL Server, Redis e RabbitMQ precisam estar saudáveis antes de qualquer aplicação iniciar.

```bash
# Na raiz do repositório:
docker compose -f infra/dev/docker-compose.dev.yml up -d

# Validar se todos os containers estão rodando com status (healthy):
docker ps
Portas ativas: SQL Server (1433), RabbitMQ (5672, Painel: http://localhost:15672 - guest/guest), Redis (6379).

Passo 2: Executar as Migrações do Banco de Dados (.NET 8 DbUp)
Aplica todos os scripts versionados de 001 a 014 com tabelas, índices e FKs multi-tenant.

Bash
# Na raiz do repositório:
dotnet run --project Database.Migrations/Database.Migrations.csproj
Resultado esperado: Mensagem verde ✅ Sucesso! O banco de dados foi atualizado para a versão mais recente.

Passo 3: Iniciar a API Core em .NET 8 (Terminal 2)
Responsável pelas regras de negócio, autenticação JWT, Mercado Pago, Dapper e mensageria.

Bash
# Entrar na pasta da API e rodar:
cd EcommerceBot.Core
dotnet run --project src/EcommerceBot.Api/EcommerceBot.Api.csproj
Acesso: Swagger disponível em http://localhost:5000/swagger ou https://localhost:7001/swagger.

Passo 4: Iniciar o Worker de IA & Scraping em Python (Terminal 3)
Consome as filas do RabbitMQ, executa scraping e integra com OpenRouter/DeepSeek.

Bash
# Entrar na pasta do worker:
cd EcommerceBot.Worker

# Ativar o ambiente virtual isolado (.venv):
source .venv/Scripts/activate  # (No Git Bash do Windows)

# Iniciar o worker assíncrono:
python -m app.main
Resultado esperado: Logs indicando conexão estabelecida com RabbitMQ (queue:ecommerce) e Redis.

Passo 5: Iniciar o Frontend Web SPA (Terminal 4)
Interface do Lojista e Dashboard de Vendas em React 18 + Vite + Tailwind.

Bash
# Entrar na pasta web:
cd EcommerceBot.Web

# Instalar dependências (caso seja a primeira vez):
npm install

# Rodar o servidor de desenvolvimento:
npm run dev
Acesso: Acesse o painel pelo navegador em http://localhost:5173.

🛠️ PARTE 2: Scripts de Manutenção do SQL Server (DBA)
Estes scripts devem ser executados após subir o container do SQL Server para configurar performance e integridade:

1. Limitar Memória (2.5 GB) e Agendar Jobs (Ola Hallengren)
Configura a memória do SQL Server para evitar travamento da VPS e instala as rotinas semanais de desfragmentação de índices.

Bash
# No Git Bash / Terminal:
chmod +x infra/prod/scripts/setup_sqlserver_maintenance.sh
./infra/prod/scripts/setup_sqlserver_maintenance.sh
☁️ PARTE 3: Rotinas de Backup & Disaster Recovery (VPS)
Scripts para execução periódica (cron) ou validação de segurança:

1. Gerar Backup com Compressão e Enviar para Cloudflare R2
Gera arquivo .bak do EcommerceBotDb, master e msdb, envia para o Cloudflare R2 e avisa no Discord.

Bash
chmod +x infra/prod/scripts/backup_sqlserver_r2.sh
./infra/prod/scripts/backup_sqlserver_r2.sh
2. Testar Restauração de Backup (Disaster Recovery)
Baixa o último backup do Cloudflare R2 e restaura uma base de teste para provar a integridade.

Bash
chmod +x infra/prod/scripts/restore_sqlserver_test.sh
./infra/prod/scripts/restore_sqlserver_test.sh
🛑 Como Parar Tudo com Segurança
Quando terminar o expediente ou quiser reiniciar o ambiente:

Bash
# 1. Pressione Ctrl + C nos terminais da API, Worker e Web.

# 2. Pare os containers preservando os dados gravados nos volumes:
docker compose -f infra/dev/docker-compose.dev.yml down

# ⚠️ APENAS se quiser apagar completamente os dados do banco e recomeçar do zero:
# docker compose -f infra/dev/docker-compose.dev.yml down -v

---