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
├── docker-compose.yml          # Postgres (5432), Redis (6379), RabbitMQ (5672/15672)
├── .env.example                # Template de variáveis de ambiente
├── ecom-autobot-api/           # 🟢 Backend Python (FastAPI)
│   ├── app/
│   │   ├── main.py             # Entrypoint FastAPI, Lifespan e inicializador dos Workers
│   │   ├── core/               # Infraestrutura compartilhada
│   │   │   ├── config/         # Settings (Pydantic), Database, RabbitMQ, Redis
│   │   │   ├── security/       # Auth JWT, AES-256 GCM (BYOK), Rate Limiter
│   │   │   └── shared/         # Logger, CSV Exporter, Progress SSE Helper
│   │   └── features/           # Módulos Funcionais DDD (Domain-Driven Design Architecture)
│   │       ├── api_router.py   # Roteador central de v1 (/api/v1)
│   │       ├── ai_enrichment/  # Providers (DeepSeek, Groq), Enriquecimento via LLM (domain, infra, schemas, services)
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
└── ecom-autobot-web/           # 🔵 Frontend Web SPA (React + TypeScript + Vite)
    ├── src/
    │   ├── components/ui/      # Atomic Design System (FormField, Button, Select, etc.)
    │   ├── features/           # Funcionalidades (live-demo, auth)
    │   ├── lib/                # Client HTTP (apiClient), SSE Client (sseClient)
    │   └── utils/              # Funções utilitárias de UI (clsx, tailwind-merge)
    └── package.json
```

---

## ⚙️ 3. Regras de Arquitetura Backend (`ecom-autobot-api`)

### 🛠️ Tech Stack:
- **Framework:** Python 3.10+ com **FastAPI** e `uvicorn`.
- **ORMs / DB:** SQLAlchemy 2.0 Async (`asyncpg`) em PostgreSQL.
- **Mensageria:** RabbitMQ via `aio-pika`.
- **Cache & Pub/Sub:** Redis via `redis-py` assíncrono.
- **Segurança:** Cryptography (`cryptography.hazmat`) para AES-256 GCM e PyJWT.
- **Resiliência:** `tenacity` para retries com exponencial backoff.

### 🏢 Multi-Tenancy & Criptografia (BYOK - Bring Your Own Key):
1. **Isolamento de Dados:** Cada consulta no repositório de produtos OU configurações DEVE conter o filtro por `tenant_id`. Chaves primárias/lógicas são compostas `(tenant_id, sku)`.
2. **Validação por Header:** O header `X-Tenant-ID` é obrigatório em rotas protegidas e validado em `get_current_tenant_user` contra a lista de `tenants` permitidos no token JWT.
3. **Criptografia AES-256 GCM:** Chaves de API dos clientes (OpenAI, Gemini, DeepSeek, Groq, Tokens Shopify/Nuvemshop) NUNCA são salvas em texto puro. Elas usam `encrypt_api_key()` e `decrypt_api_key()` no módulo `app.core.security.crypto` utilizando a chave mestre `AES_MASTER_KEY`.

### 🔄 Pipeline de Scraping & Enriquecimento de Dados (Worker Flow):
1. **Disparo / Ingestão:** `POST /api/v1/scraper/extract` envia uma mensagem para a fila RabbitMQ (`ecommerce_prod` ou `ecommerce_demo`).
2. **ScraperWorker:**
   - Consome a mensagem da fila.
   - **Estratégia 1 (Primary):** Tenta extrair metadados estruturados via `JsonLdParserService`.
   - **Estratégia 2 (Fallback):** Se JSON-LD falhar ou vier sem título/descrição, aciona `MarkdownParserService` enviando o HTML/Markdown para LLM.
   - Salva o produto no banco com estado `status = ProductStatus.RAW`.
   - Gerencia contadores de falhas por domínio (`scraping_metadata`). Ao atingir 3 falhas consecutivas sem silenciamento, dispara webhook de alerta no Discord (`NotificationService`).
3. **ProcessorWorker:**
   - Worker contínuo de background que busca produtos em estado `RAW`.
   - Altera status para `PROCESSING` e executa um timeout/cleanup para resetar jobs travados há mais de 10 minutos.
   - Invoca `LLMService` para enriquecer título (foco em conversão), copywriting magnético e tags de SEO.
   - Tenta primeiramente as chaves de API próprias do tenant (BYOK); se ausentes, faz fallback para as chaves globais do sistema.
   - Envia updates de progresso para o Redis Pub/Sub (canal `demo_progress`) se for requisição de demo.
   - Atualiza o produto para `PROCESSED` ou `FAILED`.

---

## 🎨 4. Regras de Arquitetura Frontend (`ecom-autobot-web`)

### 🛠️ Tech Stack:
- **Framework:** React 18, TypeScript, Vite.
- **Estilização:** Tailwind CSS + Vanilla CSS (sem utilitários genéricos arbitrários fora do padrão).
- **Ícones:** `lucide-react`.

### 📱 Design System & Acessibilidade (WCAG):
1. **Mobile-First:** Todo componente de formulário ou layout DEVE ser projetado primariamente para telas pequenas com adaptação para desktop.
2. **Touch Targets:** Botões e áreas clicáveis DEVEM possuir altura/largura mínima de **44px** (`min-h-[44px]` ou `h-11`).
3. **Prevenção de Auto-Zoom no iOS Safari:** Inputs, selects e textareas DEVEM possuir `font-size >= 16px` (`text-base` ou `text-sm sm:text-base`).
4. **Respeito às APIs do Navegador:** Componentes DEVEM aceitar `forwardRef`, tratar acessibilidade com atributos ARIA (`aria-invalid`, `aria-describedby`, `aria-required`) e manipular estados `disabled`, `loading` e `error`.

### 🔌 Comunicação com o Backend:
- **Client HTTP (`src/lib/apiClient.ts`):** Envia o token JWT (Bearer) no header `Authorization` e o tenant atual no header `X-Tenant-ID`.
- **Client SSE (`src/lib/sseClient.ts`):** Ouve eventos em tempo real transmitidos pelo endpoint `GET /api/v1/demo/stream` para atualizar barras de progresso e visualizações do robô.

---

## 🚨 5. Diretrizes Fundamentais para a Inteligência Artificial

Ao interagir ou gerar código neste repositório, a IA DEVE seguir estas diretrizes:

1. **Arquitetura DDD (Domain-Driven Design):** Cada feature em `app/features/<feature>/` é dividida em subpastas (`domain/`, `infrastructure/`, `repositories/`, `schemas/`, `services/`, `workers/`, `parsers/`). Sempre consulte os DTOs Pydantic na subpasta `schemas/` e os modelos SQLAlchemy na subpasta `domain/` (ou exportados via `__init__.py` da feature) antes de alterar APIs ou queries.
2. **Código Assíncrono:** No backend, NUNCA use chamadas bloqueantes síncronas. Utilize `async def`, `httpx.AsyncClient`, `AsyncSession` e `await` em Redis e RabbitMQ.
3. **Arquitetura Modular (Feature-Based):** Mantenha o isolamento dos módulos. Novas rotas devem ser incluídas no respectivo router dentro de `app/features/<feature>/router.py` e agregadas em `app/features/api_router.py`.
4. **Sem Patches Superficiais de Sintoma:** Se um erro ocorrer em um worker ou rota, resolva a causa raiz da falha em vez de ocultar com `try/except` silencioso ou retornos vazios falsos.
5. **Verificação Runtime:** NUNCA considere uma tarefa concluída sem testar a compilação/execução do código (`python -m app.main` ou `npm run build / npm run dev`).
