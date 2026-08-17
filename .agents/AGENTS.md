# 🤖 E-commerce Bot — Guia de Arquitetura & Instruções para Agentes de IA

Este documento descreve a arquitetura, pilha de tecnologias, convenções de código, regras de segurança, fluxos de dados e diretrizes de desenvolvimento do ecossistema **E-commerce Bot**. 

> **AVISO PARA IAs:** Este arquivo é a fonte da verdade para entender o projeto. Sempre consulte e siga rigorosamente estas regras ao criar, modificar ou refatorar código neste repositório.

---

## 📐 1. Visão Geral da Arquitetura

O **E-commerce Bot** é uma plataforma monorepo escalável para extração automática, enriquecimento via IA e exportação/sincronização de catálogos de produtos de e-commerce.

```
                  ┌────────────────────────────────────────┐
                  │   ecom-autobot-web (React + Vite)     │
                  └──────────────────┬─────────────────────┘
                                     │ HTTP / SSE (X-Tenant-ID + JWT)
                                     ▼
                  ┌────────────────────────────────────────┐
                  │      ecom-autobot-api (FastAPI)        │
                  └──────┬─────────────┬─────────────┬─────┘
                         │             │             │
        ┌────────────────▼──┐   ┌──────▼──────┐   ┌──▼───────────────┐
        │ PostgreSQL + DB   │   │  RabbitMQ   │   │  Redis Pub/Sub   │
        │ (SQLAlchemy Async)│   │ (aio-pika)  │   │  & Rate Limit    │
        └───────────────────┘   └──────┬──────┘   └──────────────────┘
                                       │
                         ┌─────────────┴─────────────┐
                         │      Worker Pool          │
                         │  • ScraperWorker          │
                         │  • ProcessorWorker (LLM)  │
                         │  • ExporterWorker         │
                         └───────────────────────────┘
```

---

## 📁 2. Estrutura do Monorepo

```
ecommerce-bot/
├── .agents/
│   └── AGENTS.md               # Instruções e diretrizes universais para IAs
├── infra/                      # 🛠️ Infraestrutura e Deploy Dev/Prod
│   ├── dev/                    # docker-compose.dev.yml, .env.dev.example (Postgres/Redis/RabbitMQ locais)
│   └── prod/                   # docker-compose.prod.yml, .env.prod.example, Nginx (proxy SSE), deploy.sh (VPS)
├── docker-compose.yml          # Atalho para infra/dev/docker-compose.dev.yml
├── .env.example                # Template de variáveis de ambiente
├── ecom-autobot-api/           # 🟢 Backend Python (FastAPI)
│   ├── app/
│   │   ├── main.py             # Entrypoint FastAPI, Lifespan e inicializador dos Workers
│   │   ├── core/               # Infraestrutura compartilhada
│   │   │   ├── config/         # Settings (OpenRouter, Pydantic), Database, RabbitMQ, Redis
│   │   │   ├── security/       # Auth JWT, AES-256 GCM (BYOK), Rate Limiter
│   │   │   └── shared/         # Logger, CSV Exporter, Progress SSE Helper
│   │   └── features/           # Módulos Funcionais DDD (Domain-Driven Design Architecture)
│   │       ├── api_router.py   # Roteador central de v1 (/api/v1)
│   │       ├── ai_enrichment/  # LLMEngineRouter, OpenRouterLLMProvider (DeepSeek/Llama/Gemini), Providers nativos, Schemas, Services
│   │       ├── auth/           # Login, Register, Users, Blacklist (domain, infra, repo, schemas, services)
│   │       ├── checkout/       # Mercado Pago Transparente, Pagamentos, Pedidos e Estornos (domain, infra, repo, schemas, services)
│   │       ├── mercadopago/    # Cliente Async Mercado Pago, Dispatcher & Worker de Webhooks (domain, infra, schemas, services, workers)
│   │       ├── nuvemshop/      # Client REST, OAuth & Sync Nuvemshop (infra, schemas, services)
│   │       ├── plans/          # Gestão de Planos Locais e MP Preapproval (domain, infra, repo, schemas, services)
│   │       ├── products/       # ProductModel, TenantConfigRepository, Schemas (domain, repositories, schemas)
│   │       ├── scraper/        # Worker Pool, Parsers JSON-LD/LLM, Scraper Service (parsers, schemas, services, workers)
│   │       ├── shopify/        # Client GraphQL (productSet), CSV Fallback, Sync (infra, schemas, services)
│   │       ├── subscriptions/  # Assinaturas Recorrentes MP & Cache Redis (domain, infra, repo, schemas, services)
│   │       └── system/         # Demo Stream (SSE), Health, Rate Limit, Discord Alerts (schemas, services)
│   ├── alembic/                # Migrações de banco de dados
│   ├── Dockerfile
│   └── requirements.txt
└── ecom-autobot-web/           # 🔵 Frontend Web SPA (React 18 + TypeScript + Vite + Tailwind CSS)
    ├── src/
    │   ├── components/ui/      # Atomic Design System (display, feedback, form, navigation, overlay, Button)
    │   ├── features/           # Módulos Funcionais DDD (Types -> Services -> Hooks -> UI Components)
    │   │   ├── ai-keys/        # Gestão de credenciais de IA por Tenant (BYOK: OpenRouter, DeepSeek, Groq, OpenAI, Gemini)
    │   │   ├── auth/           # Autenticação JWT, Login, Cadastro e Contexto Multi-Tenant (X-Tenant-ID)
    │   │   ├── catalog/        # Central do Catálogo, Tabela de Produtos Enriquecidos, Filtros e Exportação
    │   │   ├── checkout/       # Checkout Transparente MP (PIX QR Code/Copia e Cola e Cartão de Crédito)
    │   │   ├── live-demo/      # Live Demo com progresso em tempo real do robô via SSE (sseClient)
    │   │   ├── plans/          # Vitrine Pública de Planos e Painel Admin Mercado Pago Preapproval
    │   │   ├── scraper/        # Formulário e Ingestão de Scraping de URLs de Produtos
    │   │   └── subscription/   # Card de Faturamento Ativo do Tenant, Histórico de Assinaturas e CSV
    │   ├── layouts/            # Layouts Globais (MainLayout com Sidebar Responsiva e Header Bar)
    │   ├── lib/                # Client HTTP (apiClient Axios com JWT/X-Tenant-ID) e Client SSE (sseClient)
    │   ├── routes/             # Roteamento Central React Router (/auth, /demo, /catalog, /subscriptions, /plans, /checkout)
    │   └── utils/              # Utilitários de UI e Helpers (cn, errors, storage)
    ├── package.json
    └── vite.config.ts
```

---

## ⚙️ 3. Regras de Arquitetura Backend (`ecom-autobot-api`)

### 🛠️ Tech Stack:
- **Framework:** Python 3.10+ com **FastAPI** e `uvicorn`.
- **ORMs / DB:** SQLAlchemy 2.0 Async (`asyncpg`) em PostgreSQL.
- **Mensageria:** RabbitMQ via `aio-pika`.
- **Gateway LLM & Resiliência:** **OpenRouter** com lista de fallback encadeada (`models: [...]`) e `tenacity` para retries com exponencial backoff.
- **Cache & Pub/Sub:** Redis via `redis-py` assíncrono.
- **Segurança:** Cryptography (`cryptography.hazmat`) para AES-256 GCM e PyJWT.

### 🏛️ Estrutura Padrão Canônica de Feature Backend (Referência: `app/features/emails`):
Todas as features backend DEVEM seguir estritamente esta estrutura de pastas e divisão de responsabilidades DDD:

```
app/features/<feature_name>/
├── __init__.py                 # Ponto de entrada da feature. Exporta serviços, workers e instâncias singleton.
├── router.py                   # Roteador FastAPI (APIRouter(prefix="/<feature>", tags=["..."])). Mapeia rotas e exceções HTTP.
├── domain/                     # Regras de negócio puras e modelos de dados
│   ├── __init__.py             # Re-exporta entidades e exceções
│   ├── entities.py             # Modelos ORM SQLAlchemy Async, Enums, Mapped[...] e Índices de Tabela
│   └── exceptions.py           # Exceções de domínio estritas herdando da exceção base <Feature>DomainException
├── infrastructure/             # Gateway de Integração Externa (Resend, APIs externas, etc.)
│   ├── __init__.py             # Re-exporta clientes de infraestrutura
│   └── <gateway>_client.py     # Clientes HTTP/API assíncronos (httpx), resiliência e retries com tenacity
├── repositories/               # Camada de Acesso a Dados e Persistência Assíncrona
│   ├── __init__.py             # Re-exporta repositórios e instância singleton
│   └── <feature>_repository.py # Acesso ao banco via AsyncSession (SQLAlchemy) com isolamento por tenant e métodos atômicos
├── schemas/                    # DTOs Pydantic v2 (Validação e Serialização de Dados)
│   ├── __init__.py             # Re-exporta todos os DTOs do pacote
│   ├── <feature>_schemas.py    # DTOs para eventos de fila e respostas da API
│   ├── <gateway>_schemas.py    # DTOs para requisições e respostas de APIs externas
│   └── webhook_schemas.py      # DTOs para payload de Webhooks e verificação de assinaturas
├── services/                   # Orquestração de Aplicação e Lógica de Negócio
│   ├── __init__.py             # Re-exporta serviços de aplicação
│   ├── <feature>_dispatcher.py # Produtor de mensagens assíncronas (RabbitMQ)
│   ├── <feature>_service.py    # Lógica de aplicação/negócio
│   └── webhook_service.py      # Processamento de Webhooks (Svix/HMAC, idempotência Redis 24h, transição de estado)
├── templates/                  # (Opcional) Templates de e-mail / HTML (Jinja2)
└── workers/                    # Consumidores de Fila em Segundo Plano
    ├── __init__.py             # Re-exporta workers e instâncias singleton
    └── <feature>_worker.py     # Worker RabbitMQ com buffer híbrido (lote + timeout), ACK/NACK manual e persistência no DB
```


### 🏢 Multi-Tenancy & Criptografia (BYOK - Bring Your Own Key):
1. **Isolamento de Dados:** Cada consulta no repositório de produtos OU configurações DEVE conter o filtro por `tenant_id`. Chaves primárias/lógicas são compostas `(tenant_id, sku)`.
2. **Validação por Header:** O header `X-Tenant-ID` é obrigatório em rotas protegidas e validado em `get_current_tenant_user` contra a lista de `tenants` permitidos no token JWT.
3. **Criptografia AES-256 GCM:** Chaves de API dos clientes (OpenRouter, DeepSeek, Groq, OpenAI, Gemini, Tokens Shopify/Nuvemshop) NUNCA são salvas em texto puro. Elas usam `encrypt_api_key()` e `decrypt_api_key()` no módulo `app.core.security.crypto` utilizando a chave mestre `AES_MASTER_KEY`.
4. **Resolução de Chave LLM (`LLMEngineRouter`):**
   - O `LLMEngineRouter` busca primeiro a chave BYOK do tenant (`openrouter_api_key`) no PostgreSQL via `TenantConfigRepository`.
   - Se a chave do tenant falhar com erro 401 (não autorizada) ou 402 (sem crédito), o serviço faz **fallback automático** para a chave mestre do sistema (`OPENROUTER_API_KEY`).

### 🔄 Pipeline de Scraping & Enriquecimento de Dados (Worker Flow):
1. **Disparo / Ingestão:** `POST /api/v1/scraper/extract` envia uma mensagem para a fila RabbitMQ (`ecommerce_prod` ou `ecommerce_demo`).
2. **ScraperWorker:**
   - Consome a mensagem da fila.
   - **Estratégia 1 (Primary):** Tenta extrair metadados estruturados via `JsonLdParserService`.
   - **Estratégia 2 (Fallback):** Se JSON-LD falhar ou vier sem título/descrição, aciona `MarkdownParserService` enviando o HTML/Markdown para LLM.
   - Salva o produto no banco com estado `status = ProductStatus.RAW`.
   - Gerencia contadores de falhas por domínio (`scraping_metadata`). Ao atingir 3 falhas consecutivas sem silenciamento, dispara webhook de alerta no Discord (`NotificationService`).
3. **ProcessorWorker & LLMEngineRouter:**
   - Worker contínuo de background que busca produtos em estado `RAW`.
   - Altera status para `PROCESSING` e executa um timeout/cleanup para resetar jobs travados há mais de 10 minutos.
   - Invoca `LLMService` e `LLMEngineRouter` para enriquecer título (foco em conversão), copywriting magnético e tags de SEO enviando a lista encadeada de modelos fallback ao OpenRouter:
     1. `deepseek/deepseek-chat`
     2. `meta-llama/llama-3.3-70b-instruct`
     3. `google/gemini-flash-1.5`
   - Salva no JSON `enrichment_metadata` do produto os dados de auditoria: `model_used`, `prompt_tokens`, `completion_tokens`, `total_tokens` e `response_time_ms`.
   - Registra a telemetria com uso real de tokens no `TelemetryRepository`.
   - Registra log estruturado: `[ProcessorWorker] Produto {sku} enriquecido com sucesso via {model_used} em {response_time_ms}ms`.
   - Envia updates de progresso para o Redis Pub/Sub (canal `demo_progress`) se for requisição de demo.
   - Atualiza o produto para `PROCESSED` ou `FAILED`.

---

## 🎨 4. Regras de Arquitetura Frontend (`ecom-autobot-web`)

### 🛠️ Tech Stack:
- **Framework:** React 18, TypeScript, Vite.
- **Estilização:** Tailwind CSS + Vanilla CSS (sem utilitários genéricos arbitrários fora do padrão).
- **Roteamento:** React Router DOM.
- **Ícones:** `lucide-react`.

### 🏗️ Padrão Arquitetural de Feature (Feature-Based Architecture):
Todo módulo funcional em `src/features/<feature>/` DEVE seguir estritamente o fluxo em 4 camadas:
1. **`types/` (`<feature>.type.ts`):** Definição de contratos TypeScript alinhados aos Schemas Pydantic / DTOs do backend.
2. **`services/` (`<feature>.service.ts`):** Encapsulamento de chamadas HTTP utilizando o `apiClient` com tratamento de erros.
3. **`hooks/` (`use<Feature>.ts`):** Hook customizado para gerenciar estado reativo, requisições, filtros e loading/error states.
4. **`components/` & `pages/`:** Componentes de UI pura e páginas de visualização responsivas (Mobile-First).

### 🧩 Módulos Funcionais do Frontend:
1. **Autenticação & Multi-Tenancy (`src/features/auth`):**
   - Autenticação via JWT (Bearer) com salvamento de tokens e tenant ativo no `localStorage`.
   - Injeção automática dos headers `Authorization` e `X-Tenant-ID` no `apiClient`.
2. **Central do Catálogo (`src/features/catalog`):**
   - Visualização e gerenciamento de produtos com estados (`RAW`, `PROCESSING`, `PROCESSED`, `FAILED`).
   - Exportação direta de catálogos para arquivos CSV, Shopify e Nuvemshop.
3. **Demonstração em Tempo Real (`src/features/live-demo`):**
   - Transmissão ao vivo de etapas de scraping e enriquecimento com IA usando `sseClient` (`GET /api/v1/demo/stream`).
4. **Checkout Transparente Mercado Pago (`src/features/checkout`):**
   - Aba **PIX**: Exibição de QR Code Base64, botão Copia e Cola com feedback visual ("Copiado!"), cronômetro de expiração em tempo real (`MM:SS`) e polling automático a cada 4s chamando `syncOrderStatus`.
   - Aba **Cartão de Crédito**: Form transparente com mascaramento dinâmico de cartão (`0000 0000 0000 0000`), expiração (`MM/AA`), CVV, parcelamento em até 12x e identificação automática de bandeira.
5. **Gestão de Planos (`src/features/plans`):**
   - **Vitrine Pública (`PublicPlanCards`):** Cards responsivos com preços formatados em R$, badges de teste grátis e atalhos de contratação.
   - **Painel Administrativo (`AdminPlanTable` & `AdminPlanModal`):** Gerenciamento e criação/edição de planos sincronizados com o Mercado Pago Preapproval.
6. **Assinaturas & Faturamento (`src/features/subscription`):**
   - Exibição da assinatura ativa do tenant (`SubscriptionBillingCard`), validade, valor recorrente e diálogo de confirmação de cancelamento.
   - Tabela de histórico de assinaturas (`SubscriptionHistoryTable`) com badges coloridos (`authorized` = verde, `pending` = amarelo, `cancelled` = vermelho, `paused` = azul) e exportação para CSV.
7. **Credenciais de IA / BYOK (`src/features/ai-keys`):**
   - Modal para cadastro e atualização criptografada de chaves de API próprias por tenant (OpenRouter, DeepSeek, Groq, OpenAI, Gemini).
8. **Web Scraper & Ingestão (`src/features/scraper`):**
   - Formulário de disparo assíncrono de extração de produtos a partir de URLs de e-commerce.

### 📱 Design System & Acessibilidade (WCAG):
1. **Mobile-First:** Todo componente de formulário ou layout DEVE ser projetado primariamente para telas pequenas com adaptação para desktop.
2. **Touch Targets:** Botões e áreas clicáveis DEVEM possuir altura/largura mínima de **44px** (`min-h-[44px]` ou `h-11`).
3. **Prevenção de Auto-Zoom no iOS Safari:** Inputs, selects e textareas DEVEM possuir `font-size >= 16px` (`text-base` ou `text-sm sm:text-base`).
4. **Respeito às APIs do Navegador:** Componentes DEVEM aceitar `forwardRef`, tratar acessibilidade com atributos ARIA (`aria-invalid`, `aria-describedby`, `aria-required`) e manipular estados `disabled`, `loading` e `error`.
5. **Estilização Padronizada:** Utilização de Tailwind CSS combinada com o utilitário `cn` (`clsx` + `tailwind-merge`) importado de `@/utils/cn`.

### 🔌 Comunicação com o Backend:
- **Client HTTP (`src/lib/apiClient.ts`):** Envia o token JWT (Bearer) no header `Authorization` e o tenant atual no header `X-Tenant-ID`.
- **Client SSE (`src/lib/sseClient.ts`):** Ouve eventos em tempo real transmitidos pelo endpoint `GET /api/v1/demo/stream` para atualizar barras de progresso e visualizações do robô.

---

## 🚨 5. Diretrizes Fundamentais para a Inteligência Artificial

Ao interagir ou gerar código neste repositório, a IA DEVE seguir estas diretrizes:

1. **Arquitetura DDD (Domain-Driven Design):** Cada feature em `app/features/<feature>/` é dividida em subpastas (`domain/`, `infrastructure/`, `repositories/`, `schemas/`, `services/`, `workers/`, `parsers/`). Sempre consulte os DTOs Pydantic na subpasta `schemas/` e os modelos SQLAlchemy na subpasta `domain/` (ou exportados via `__init__.py` da feature) antes de alterar APIs ou queries.
2. **Código Assíncrono:** No backend, NUNCA use chamadas bloqueantes síncronas. Utilize `async def`, `httpx.AsyncClient`, `AsyncSession` e `await` em Redis e RabbitMQ.
3. **Arquitetura Modular (Feature-Based):** Mantenha o isolamento dos módulos no backend e no frontend (`Types -> Services -> Hooks -> UI Components`). Novas rotas devem ser incluídas no respectivo router.
4. **Sem Patches Superficiais de Sintoma:** Se um erro ocorrer em um worker ou rota, resolva a causa raiz da falha em vez de ocultar com `try/except` silencioso ou retornos vazios falsos.
5. **Verificação Runtime:** NUNCA considere uma tarefa concluída sem testar a compilação/execução do código (`python -m app.main` ou `npm run build / npm run dev`).
