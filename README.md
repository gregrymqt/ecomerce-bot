# E-commerce Bot 🛒🤖

Um microserviço escalável focado em extração, processamento e enriquecimento de dados de produtos de e-commerce utilizando Inteligência Artificial (OpenAI e Gemini).

## 🏗️ Arquitetura do Sistema

O projeto evoluiu para uma arquitetura de microserviço baseada no **FastAPI**, processamento assíncrono profundo (via `asyncio` e `aio-pika`), e filas do **RabbitMQ**.

- **API Central (FastAPI):** Expõe rotas HTTP sob demanda. Possui rotas de Landing Page (`/demo`) integradas com mensageria e rotas de extração de relatórios (`/export`). Conta com dependências robustas como Rate Limiting (armazenado no Redis).
- **Stream SSE (/v1/demo/stream):** Endpoint Server-Sent Events que transmite em tempo real as etapas de execução da demonstração para o Portal, escutando notificações assíncronas vindas dos Workers.
- **Mensageria & Redis Pub/Sub:** Topologia com isolamento multi-tenant via RabbitMQ para as filas de demonstração (`ecommerce_demo`) e clientes (`ecommerce_prod`). Pub/Sub Redis (canal `"demo_progress"`) para gerenciar as notificações de progresso efêmeras de forma ágil e sem poluir o broker de mensagens.
- **ScraperWorker:** Ouve ativamente a fila do RabbitMQ em background. Realiza as estratégias de crawling/parsing (JsonLD ou Markdown/LLM Fallback), salva os produtos no banco e processa contratos externos da arquitetura C# (PascalCase), publicando o progresso inicial de scraping.
- **ProcessorWorker:** Robô independente que busca itens recém scrapeados ou em falha no banco de dados para envio às LLMs. Executa rotinas de enriquecimento copywriting e tags de busca, publicando o progresso final e dados otimizados.
- **ExporterWorker:** Agente encapsulado para criar exportações paginadas e padronizadas (gerando arquivos CSV para plataformas como Shopify e Nuvemshop). Ele suporta segurança Multi-Tenant via filtragem e paginação para não estourar a memória (OOM).
- **Database (PostgreSQL / Supabase):** Central de estado relacional. Seus índices compostos e chaves primárias compostas `(tenant_id, sku)` garantem estrito isolamento de dados por cliente e previnem vazamentos cross-tenant.

## 🚀 Como Rodar o Projeto Localmente

### 1. Pré-requisitos
- Python 3.10+ instalado.
- Gerenciador de pacotes `uv` (opcional, porém recomendado para altíssima performance).
- Docker e Docker Compose (necessários para subir o PostgreSQL, Redis e o RabbitMQ).

### 2. Subindo a Infraestrutura
Inicie as dependências do ambiente via Docker. O compose levantará tanto o banco de dados quanto o cache e o broker de mensageria:
```bash
docker compose up -d
```

### 3. Configuração de Ambiente (.env)
Crie um arquivo `.env` na raiz, baseando-se nas variáveis suportadas pelo `settings.py`:
```env
# Chaves de API das Inteligências Artificiais e Segurança BYOK
OPENAI_API_KEY=sk-sua-chave-aqui
GEMINI_API_KEY=sua-chave-gemini-aqui
AES_MASTER_KEY=chave_mestre_base64_aes256_32bytes

# Conexões de Infraestrutura (Padrão para uso local com Docker Compose)
POSTGRES_URI=postgresql://postgres:postgres@localhost:5432/greg_company
RABBITMQ_URL=amqp://guest:guest@localhost:5672/
REDIS_URL=redis://localhost:6379/0

# Alertas Críticos e Notificações (Slack / Discord)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/dummy
```

### 4. Instalação e Execução
O projeto utiliza o `uvicorn` sob o capô para inicializar o FastAPI e as rotinas background:

**Recomendado (com UV):**
```bash
uv venv
uv pip install -r requirements.txt
uv run python -m app.main
```

**Alternativo (com pip clássico):**
```bash
python -m venv venv
.\venv\Scripts\activate  # No Linux: source venv/bin/activate
pip install -r requirements.txt
python -m app.main
```

> **Nota:** Ao rodar, a API ficará online em `http://localhost:8000`. Os workers de scraping (escutando as filas prod e demo) junto ao processador de enriquecimento de IA são inicializados concorrentemente no evento de _lifespan_ do FastAPI, rodando de forma assíncrona sem travar as requisições HTTP.
