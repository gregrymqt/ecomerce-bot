# E-commerce Bot 🛒🤖

Um ecossistema escalável focado em extração, processamento e enriquecimento automático de dados de produtos de e-commerce utilizando o Gateway OpenRouter (com suporte encadeado a DeepSeek, Meta Llama 3.3 e Google Gemini 1.5, além de resolução BYOK por tenant).

---

## 📁 Estrutura do Repositório (Monorepo)

O projeto é dividido em 4 pilares principais:

* ⚡ **`EcommerceBot.Core/`**: API Central em .NET 8 (C#) seguindo Clean Architecture / DDD, responsável por autenticação, autorização, regras de negócio, persistência Dapper, pagamentos e orquestração.
* 🔷 **`Database.Migrations/`**: Runner de migrações determinísticas em .NET 8 com DbUp para **Microsoft SQL Server 2022**.
* 🐍 **`EcommerceBot.Worker/`**: Microsserviço Python (Workers assíncronos) focado estritamente em inferência LLM (OpenRouter/DeepSeek), Scraping inteligente e Machine Learning preditivo (Scikit-Learn).
* 🔵 **`EcommerceBot.Web/`**: Portal Web Frontend construído em React 18, TypeScript, Vite e Tailwind CSS.
* 🛠️ **`infra/`**: Configurações de infraestrutura isoladas para **Desenvolvimento** (`infra/dev`) e **Produção VPS** (`infra/prod`).

---

## 🏗️ Arquitetura do Sistema

A API Backend foi projetada em uma arquitetura de microserviços assíncronos baseada em **FastAPI** (`asyncio` e `aio-pika`), e filas do **RabbitMQ**.

```mermaid
graph TD
    A["Client Web / Frontend React"] -->|1. Requisição de Extração| B["FastAPI - Router Central"]
    B -->|2. Enfileira Job| C[("RabbitMQ - Raw Queue")]

    subgraph S1 ["1. Ingestao e Web Scraping (Extract)"]
        C --> D["ScraperWorker"]
        D -->|Dados Brutos| E[("RabbitMQ - Process Queue")]
    end

    subgraph S2 ["2. Processamento e IA (Transform)"]
        E --> F["ProcessorWorker"]
        F -->|3. Enriquecimento| G["LLM Engine Router: OpenRouter (DeepSeek / Llama 3.3 / Gemini) + BYOK Tenant Fallback"]
        F -->|4. Persiste Estado| H[("PostgreSQL")]
        F -->|5. Telemetria e SSE| I[("Redis Cache / PubSub")]
    end

    subgraph S3 ["3. Carga e Exportacao (Load)"]
        H --> J["ExporterWorker"]
        J -->|6. Payload CSV/XLSX em Memoria| K["Exportacao: Shopify e Nuvemshop"]
    end
```

---

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
* **ProcessorWorker & LLMEngineRouter**: Robô independente de IA. Utiliza o `LLMEngineRouter` enviando requisições ao OpenRouter com fallback encadeado de modelos (`deepseek/deepseek-chat` -> `meta-llama/llama-3.3-70b-instruct` -> `google/gemini-flash-1.5`). Resolve automaticamente chaves BYOK por tenant ou chave global, registrando os dados de auditoria (`model_used`, tokens consumidos e tempo de resposta) no campo `enrichment_metadata`.
* **ExporterWorker**: Agente assíncrono para gerar arquivos CSV otimizados e paginados para plataformas como Shopify e Nuvemshop, garantindo isolamento Multi-Tenant e prevenindo estouro de memória (OOM).
* **Database (PostgreSQL / Supabase)**: Central de estado relacional com SQLAlchemy assíncrono (`asyncpg`). Índices compostos e chaves primárias `(tenant_id, sku)` garantem estrito isolamento por cliente.

---

### 🌐 Componentes e Recursos do Frontend (`ecom-autobot-web`)

O portal Web Frontend foi desenvolvido em **React 18**, **TypeScript**, **Vite** e **Tailwind CSS**, estruturado no padrão **Feature-Based Architecture** (`Types -> Services -> Hooks -> UI Components`):

* **Módulos Funcionais (`src/features/`)**:
  * **Central do Catálogo (`/catalog`)**: Hub para visualização de produtos extraídos (`RAW`, `PROCESSING`, `PROCESSED`, `FAILED`), filtros interativos, badges de SEO e exportação rápida para CSV, Shopify e Nuvemshop.
  * **Demonstração ao Vivo (`/demo`)**: Transmissão Server-Sent Events (`sseClient`) para acompanhar em tempo real as etapas de extração e enriquecimento dos produtos pelo robô.
  * **Assinaturas & Faturamento (`/subscriptions`)**: Card do plano ativo do tenant (`SubscriptionBillingCard`), validade da cobrança recorrente, diálogo de confirmação de cancelamento e histórico paginado com exportação CSV.
  * **Planos Mercado Pago (`/plans`)**: Vitrine pública com preços formatados em R$, badges de teste grátis e Painel Administrativo (`AdminPlanTable` e `AdminPlanModal`) para criar e editar planos Preapproval.
  * **Checkout Transparente (`/checkout`)**: Widget de pagamento com abas para **PIX** (QR Code em Base64, botão Copia e Cola com feedback "Copiado!", cronômetro de expiração e polling a cada 4s via `syncOrderStatus`) e **Cartão de Crédito** (mascaramento de campos, parcelamento em até 12x e identificação de bandeira).
  * **Autenticação & Multi-Tenancy (`/auth`)**: Formulários de login/registro, persistência JWT em `localStorage` e envio automático dos headers `Authorization` e `X-Tenant-ID`.
  * **Credenciais de IA / BYOK (`ai-keys`)**: Modais para cadastro e gerenciamento de chaves próprias de API (OpenRouter, DeepSeek, Groq, OpenAI, Gemini).
  * **Web Scraper (`scraper`)**: Form de disparo e ingestão assíncrona de URLs de produtos para scraping.

* **Design System & Acessibilidade**:
  * **Design Mobile-First**: Layout fluido adaptável a dispositivos móveis e desktops.
  * **Touch Targets (WCAG)**: Botões e campos com dimensionamento mínimo de **44px** (`min-h-[44px]` ou `h-11`).
  * **Prevenção de Auto-Zoom**: Inputs com `font-size >= 16px` para evitar zoom indesejado no iOS Safari.

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
Crie um arquivo `.env` na raiz do projeto ou dentro de `ecom-autobot-api/.env`, baseando-se nas variáveis suportadas por `app/core/config/settings.py`:

```env
# Gateway OpenRouter e Chaves de IA Globais
OPENROUTER_API_KEY=sua-chave-openrouter-master
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
DEFAULT_PRIMARY_MODEL=deepseek/deepseek-chat
DEFAULT_FALLBACK_MODEL_1=meta-llama/llama-3.3-70b-instruct
DEFAULT_FALLBACK_MODEL_2=google/gemini-flash-1.5

# Provedores Nativos / Legados (Opcional)
DEEPSEEK_API_KEY=
GROQ_API_KEY=

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
