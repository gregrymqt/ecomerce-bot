# E-commerce Bot 🛒🤖

Um ecossistema escalável focado em extração, processamento e enriquecimento automático de dados de produtos de e-commerce utilizando Inteligência Artificial (OpenAI, Gemini, DeepSeek, Groq).

---

## 📁 Estrutura do Repositório (Monorepo)

O projeto é dividido em dois serviços principais:

* 🟢 **`ecom-autobot-api/`**: API Central e Workers em Python (FastAPI, RabbitMQ, Redis, PostgreSQL).
* 🔵 **`ecom-autobot-web/`**: Portal Web Frontend construído em React, TypeScript e Vite.

---

## 🏗️ Arquitetura do Sistema

A API Backend foi projetada em uma arquitetura de microserviço baseada em **FastAPI**, processamento assíncrono profundo (via `asyncio` e `aio-pika`), e filas do **RabbitMQ**.

### 🔌 Componentes da API Central (`ecom-autobot-api`)

A API segue uma arquitetura modular baseada em **Domain-Driven Design (DDD)** e **Clean Architecture**, dividida em 11 módulos funcionais desacoplados:

* **Rotas da API Central (FastAPI)**: Expõe endpoints sob o prefixo `/api/v1`:
  * **Operações do Sistema (`/api/v1`)**:
    * `POST /api/v1/demo`: Disparo de solicitações de demonstração com rate-limiting no Redis.
    * `GET /api/v1/export`: Rota de download e exportação de dados enriquecidos.
    * `GET /api/v1/health`: Verificação de integridade do serviço.
    * `GET /api/v1/demo/stream`: Endpoint Server-Sent Events (SSE) para transmissão de progresso em tempo real.
  * **AI & Web Scraper (`/api/v1`)**:
    * `POST /api/v1/ai/credentials`: Cadastro e atualização criptografada de credenciais de IA por tenant (BYOK).
    * `POST /api/v1/scraper/extract`: Disparo assíncrono de tarefas de web scraping via RabbitMQ.
  * **Plataformas de E-commerce & Integrações (`/api/v1`)**:
    * **Shopify (`/api/v1/shopify`)**: Sincronização GraphQL (`productSet`), mídias, atualizações e fallback para CSV.
    * **Nuvemshop (`/api/v1/nuvemshop`)**: Importação e sincronização nativa de produtos via API REST Nuvemshop.
  * **Financeiro, Pagamentos & Subscrições (`/api/v1`)**:
    * **Checkout Transparente (`/api/v1/checkout`)**: Criação de preferências, processamento de pagamentos e estornos Mercado Pago.
    * **Planos (`/api/v1/plans`)**: Gestão de planos de assinatura locais e sincronizados via Mercado Pago Preapproval.
    * **Assinaturas (`/api/v1/subscriptions`)**: Gestão de assinaturas recorrentes com estratégia de cache Redis.
    * **Webhooks (`/api/v1/mercadopago`)**: Receptor e distribuidor assíncrono de notificações de pagamento e assinaturas.

* **Mensageria & Redis Pub/Sub**: Topologia com isolamento multi-tenant via RabbitMQ para as filas de demonstração (`ecommerce_demo`) e clientes (`ecommerce_prod`). Pub/Sub Redis (canal `"demo_progress"`) para gerenciar as notificações de progresso efêmeras consumidas no stream SSE.
* **ScraperWorker**: Ouve ativamente as filas do RabbitMQ em background. Executa estratégias de crawling e parsing (JsonLD ou Markdown/LLM Fallback), salva os produtos no banco e notifica o progresso inicial.
* **ProcessorWorker**: Robô independente que busca itens recém scrapeados no banco de dados para envio às LLMs. Executa rotinas de copywriting, tags de busca e SEO.
* **ExporterWorker**: Agente assíncrono para gerar arquivos CSV otimizados e paginados para plataformas como Shopify e Nuvemshop, garantindo isolamento Multi-Tenant e prevenindo estouro de memória (OOM).
* **Database (PostgreSQL / Supabase)**: Central de estado relacional com SQLAlchemy assíncrono (`asyncpg`). Índices compostos e chaves primárias `(tenant_id, sku)` garantem estrito isolamento por cliente.

---

## 🚀 Como Rodar o Projeto Localmente

### 1. Pré-requisitos
* **Python 3.10+** instalado.
* **Node.js 18+** e `npm` (para o frontend web).
* Gerenciador **`uv`** (opcional, porém recomendado para alta performance em Python).
* **Docker** e **Docker Compose** (necessários para subir o PostgreSQL, Redis e RabbitMQ).

---

### 2. Subindo a Infraestrutura (Docker)
Na raiz do projeto, inicie os contêineres do PostgreSQL, Redis e RabbitMQ:
```bash
docker compose up -d
```

---

### 3. Configuração de Ambiente (.env)
Crie um arquivo `.env` na raiz do projeto ou dentro de `ecom-autobot-api/.env`, baseando-se nas variáveis suportadas por `app/config/settings.py`:

```env
# Chaves de API de Inteligência Artificial (BYOK / Provedores Globais)
OPENAI_API_KEY=sk-sua-chave-openai
GEMINI_API_KEY=sua-chave-gemini
DEEPSEEK_API_KEY=sua-chave-deepseek
GROQ_API_KEY=sua-chave-groq

# Criptografia e Segurança Multi-Tenant
AES_MASTER_KEY=chave_mestre_base64_aes256_32bytes
JWT_SECRET_KEY=sua_chave_secreta_jwt

# Conexões de Infraestrutura (Padrão para Docker Compose Local)
POSTGRES_URI=postgresql://postgres:postgres@localhost:5432/ecommerce_bot_db
RABBITMQ_URL=amqp://guest:guest@localhost:5672/
REDIS_URL=redis://localhost:6379/0
REDIS_PASSWORD=

# Alertas Críticos e Notificações
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/dummy
```

---

### 4. Executando o Backend (`ecom-autobot-api`)

Entre na pasta da API:
```bash
cd ecom-autobot-api
```

**Opção A: Recomendado (com UV)**
```bash
uv venv
uv pip install -r requirements.txt
uv run python -m app.main
```

**Opção B: Com venv e pip tradicional**
```bash
python -m venv venv
# No Windows (PowerShell):
.\venv\Scripts\activate
# No Linux/Mac:
# source venv/bin/activate

pip install -r requirements.txt
python -m app.main
```

> ℹ️ **Nota:** A API ficará disponível em `http://localhost:8000`. A documentação interativa Swagger (OpenAPI) pode ser acessada em `http://localhost:8000/docs`.

---

### 5. Executando o Frontend (`ecom-autobot-web`)

Em outro terminal, acesse a pasta do frontend:
```bash
cd ecom-autobot-web
npm install
npm run dev
```

> ℹ️ **Nota:** O portal web ficará acessível no endereço indicado pelo Vite (geralmente `http://localhost:5173`).
