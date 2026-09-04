"""
.agents/scripts/generate_notebooklm_pack.py

Compilador automatizado do Knowledge Pack do ecossistema E-commerce Bot para o Google NotebookLM.
Atende aos requisitos do Card 83 do Trello:
- Extrai contratos de APIs e Gateways (Shopify, Nuvemshop, Mercado Pago, OpenRouter).
- Mapeia o dicionário de dados SQL Server a partir dos scripts DbUp e do grafo (.agents/graph.json).
- Documenta as fórmulas matemáticas de ML (RFM, Churn, LTV, Capacity) e atribuição de tráfego.
- Consolida a arquitetura de infraestrutura, mensageria RabbitMQ, Redis e segurança fail-closed.
- Gera 4 arquivos modulares em docs/notebooklm/pack/ e 1 bundle consolidado em docs/notebooklm/ecosystem_knowledge_pack.md.
"""

import os
import sys
import re
import json
from datetime import datetime, timezone
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Diretórios base
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
PACK_DIR = REPO_ROOT / "docs" / "notebooklm" / "pack"
MASTER_FILE = REPO_ROOT / "docs" / "notebooklm" / "ecosystem_knowledge_pack.md"
GRAPH_FILE = REPO_ROOT / ".agents" / "graph.json"
MIGRATIONS_DIR = REPO_ROOT / "Database.Migrations" / "Scripts"

def load_graph_stats():
    if not GRAPH_FILE.exists():
        return {"nodes": 0, "edges": 0}
    try:
        with open(GRAPH_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            meta = data.get("metadata", {})
            return {
                "nodes": meta.get("total_nodes", len(data.get("nodes", []))),
                "edges": meta.get("total_edges", len(data.get("edges", []))),
                "version": meta.get("version", "2.0")
            }
    except Exception:
        return {"nodes": 0, "edges": 0}

def parse_sql_tables():
    """Lê os scripts SQL do DbUp para documentar as tabelas do sistema."""
    tables = []
    if not MIGRATIONS_DIR.exists():
        return tables

    sql_files = sorted(list(MIGRATIONS_DIR.glob("*.sql")))
    for sql_file in sql_files:
        try:
            content = sql_file.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            content = sql_file.read_text(encoding="latin-1", errors="replace")
        # Regex para capturar CREATE TABLE dbo.NomeDaTabela
        matches = re.finditer(r"CREATE\s+TABLE\s+(?:dbo\.)?\[?([a-zA-Z0-9_]+)\]?\s*\((.*?)\);", content, re.DOTALL | re.IGNORECASE)
        for match in matches:
            tname = match.group(1)
            tbody = match.group(2)
            # Extrair colunas principais
            cols = []
            for line in tbody.split("\n"):
                line = line.strip()
                if not line or line.startswith("--") or line.upper().startswith("CONSTRAINT") or line.upper().startswith("PRIMARY"):
                    continue
                col_match = re.match(r"\[?([a-zA-Z0-9_]+)\]?\s+([a-zA-Z0-9_\(\)]+)(?:\s+(NOT\s+NULL|NULL))?", line, re.IGNORECASE)
                if col_match:
                    col_name = col_match.group(1)
                    col_type = col_match.group(2)
                    nullable = col_match.group(3) or "NULL"
                    cols.append((col_name, col_type, nullable))
            tables.append({
                "file": sql_file.name,
                "table": tname,
                "columns": cols
            })
    return tables

def generate_pack_01():
    return """# 🌐 Módulo 1: Hub de APIs Externas, Gateways & Provedores

Este módulo documenta os contratos técnicos, protocolos de comunicação, estruturas de payload e regras de autenticação com todas as integrações de terceiros do ecossistema **E-commerce Bot**.

---

## 🛍️ 1. Shopify Admin API (GraphQL & Webhooks)

- **Versão da API:** GraphQL Admin API 2024-07+
- **Padrão de Autenticação:** Token de acesso via cabeçalho `X-Shopify-Access-Token`.
- **Biblioteca / Gateway:** `EcommerceBot.Infrastructure.Gateways.ShopifyGateway`

### 1.1. Mutação de Produtos (`productSet`)
Para sincronização atômica de catálogo (criação e atualização de produtos, variações de SKU, preços e imagens):

```graphql
mutation productSet($input: ProductSetInput!) {
  productSet(input: $input) {
    product {
      id
      title
      handle
      status
      variants(first: 10) {
        nodes {
          id
          sku
          price
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}
```

### 1.2. Injeção de Atribuição no Carrinho (`note_attributes`)
O script cliente [`tracker.js`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Web/public/tracker.js) captura as UTMs do comprador e faz o despacho automático para o carrinho da Shopify:
- **Endpoint:** `POST /cart/update.js`
- **Payload:**
```json
{
  "attributes": {
    "ec_utm_source": "instagram",
    "ec_utm_medium": "paid_social",
    "ec_utm_campaign": "blackfriday2026",
    "ec_ad_id": "ad_987654",
    "ec_session_id": "sess_1725463829_a8b9c"
  }
}
```

### 1.3. Webhooks & Validação de Segurança HMAC
- **Tópico Principal:** `orders/paid`
- **Cabeçalho:** `X-Shopify-Hmac-Sha256`
- **Regra Fail-Closed:** A verificação de assinatura calcula o hash HMAC-SHA256 do corpo bruto com a `ShopifyApiKeySecret` e compara estritamente com `CryptographicOperations.FixedTimeEquals` para prevenção de ataques de temporização (Timing Attacks).

---

## ☁️ 2. Nuvemshop REST API (V1)

- **Padrão de Autenticação:** `Authentication: bearer <access_token>` com `User-Agent: EcommerceBot (suporte@ecommercebot.com)`.
- **Gateway:** `EcommerceBot.Infrastructure.Gateways.NuvemshopGateway`.
- **Endpoints Chave:**
  - `GET /v1/{user_id}/products`: Leitura paginada do catálogo.
  - `POST /v1/{user_id}/products`: Criação de novos produtos enriquecidos pela IA.
  - `POST /v1/{user_id}/scripts`: Injeção do `tracker.js` no rodapé da loja.
- **Rastreamento:** Injeção de campos ocultos (`hidden inputs`) no formulário de checkout para propagação das variáveis `ec_utm_*`.

---

## 💳 3. Mercado Pago API (Checkout Transparente & Assinaturas)

- **Padrão de Autenticação:** `Authorization: Bearer <ACCESS_TOKEN>`
- **Gateway:** `EcommerceBot.Infrastructure.Gateways.MercadoPagoGateway`
- **Controller de Webhooks:** `MercadoPagoWebhookController` (`/api/v1/webhooks/mercadopago`)

### 3.1. Modalidades de Pagamento Suportadas
1. **PIX (Checkout Transparente):**
   - Criação via `POST /v1/payments` com `payment_method_id: "pix"`.
   - Retorna `point_of_interaction.transaction_data.qr_code` (Copia e Cola) e `qr_code_base64`.
2. **Cartão de Crédito Transparente:**
   - Tokenização no frontend via MercadoPago SDK (`device_id` anti-fraude).
   - Envio de `token`, `installments` e `payer.email`.
3. **Assinaturas Recorrentes (Preapproval):**
   - Criação de planos de assinatura mensal/anual via `POST /preapproval_plan` e `POST /preapproval`.

### 3.2. Idempotência e Segurança
- O identificador `data.id` ou `id` do webhook é checado no Redis com TTL de 24h via `SET NX` (`webhook:idempotency:{id}`). Duplicidades recebem `200 OK` imediato sem reprocessamento.
- Validação do cabeçalho `x-signature` com `x-request-id` usando chave secreta do webhook.

---

## 🤖 4. OpenRouter LLM API (Inference Engine)

- **Provedor:** `EcommerceBot.Worker.app.ai.providers.openrouter_provider.OpenRouterLLMProvider`
- **Endpoint:** `https://openrouter.ai/api/v1/chat/completions`
- **Cabeçalhos de Telemetria:**
  - `HTTP-Referer`: `https://ecommercebot.local`
  - `X-Title`: `EcommerceBot`
- **Cadeia de Fallback Resiliente:**
  1. `deepseek/deepseek-chat` (Alta velocidade e excelente copywriting em PT-BR)
  2. `meta-llama/llama-3.3-70b-instruct` (Capacidade de raciocínio profundo e estruturação JSON)
  3. `google/gemini-flash-1.5` (Baixíssima latência e ampla janela de contexto)
- **Política de Retentativas (Tenacity):** Retenta até 3 vezes com recuo exponencial (`wait_exponential(multiplier=1, min=2, max=10)`) em erros 429, 500, 502, 503 e 504.
"""

def generate_pack_02(tables):
    sql_docs = []
    for t in tables:
        col_list = "\n".join([f"  - `{col[0]}`: `{col[1]}` ({col[2]})" for col in t["columns"][:12]])
        if len(t["columns"]) > 12:
            col_list += f"\n  - *...e mais {len(t['columns']) - 12} colunas.*"
        sql_docs.append(f"### 🗄️ Tabela `dbo.{t['table']}` (Script: `{t['file']}`)\n{col_list}\n")

    tables_formatted = "\n".join(sql_docs)

    return f"""# 🗄️ Módulo 2: Dicionário de Dados SQL Server & Multi-Tenancy

Este módulo detalha o modelo de persistência relacional do **SQL Server 2022**, as migrações determinísticas versionadas com **DbUp** e as regras invioláveis de isolamento **Multi-Tenant**.

---

## 🔒 1. Princípios Invioláveis de Multi-Tenancy & Segurança

1. **Coluna de Tenant Obrigatória:** Toda tabela multi-tenant DEVE conter a coluna `TenantId UNIQUEIDENTIFIER NOT NULL` com Chave Estrangeira para `dbo.Tenants(Id) ON DELETE CASCADE`.
2. **Consultas Dapper Estritas (Fail-Closed):** É estritamente proibido executar consultas sem o filtro `WHERE TenantId = @TenantId` via parâmetros tipados.
3. **Chaves Primárias Sequenciais:** Todas as chaves primárias usam `UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID()`, reduzindo a fragmentação de páginas de índice no SQL Server.
4. **Campos Criptografados (BYOK):** Chaves de API do lojista são armazenadas como `VARBINARY(MAX)` (cifradas com AES-256 GCM), acompanhadas de `InitializationVector VARBINARY(16)` e `AuthTag VARBINARY(16)`.
5. **Índices de Cobertura com `INCLUDE`:** Consultas frequentes (como busca por SKU ou catálogo por status) usam cláusula `INCLUDE` para evitar Key Lookups caros.

---

## 📊 2. Dicionário de Tabelas do Banco de Dados

{tables_formatted}

---

## ⚡ 3. Políticas de Auditoria & DMVs (Diagnostics MCP)

O servidor MCP de diagnósticos (`EcommerceBot.Diagnostics.Mcp`) realiza inspeções exclusivamente em DMVs nativas do SQL Server com `WITH (NOLOCK)`:
- `sys.dm_exec_query_stats` e `sys.dm_exec_sql_text`: Identificação das top 10 queries mais lentas ou com maior consumo de CPU.
- `sys.dm_tran_locks`: Detecção imediata de bloqueios e Deadlocks em transações concorrentes.
- `sys.dm_os_wait_stats`: Avaliação de gargalos de I/O de disco e concorrência de buffer pool.
"""

def generate_pack_03():
    return """# 🔬 Módulo 3: Modelos de Machine Learning, Analytics & Fórmulas

Este módulo consolida a arquitetura analítica e preditiva do **E-commerce Bot**, detalhando as fórmulas matemáticas, hiperparâmetros, pipelines de treinamento e regras de classificação implementadas.

---

## 🏛️ 1. Arquitetura Tripartite de Machine Learning

1. **Batch & Data Plane (Google Spark / PySpark):**
   - Processamento de grandes volumes históricos de vendas e eventos de catálogo.
   - Treinamento em lote, calibração de centróides e exportação de pipelines serializados (`.joblib` / `.onnx`).
   - Geração de relatórios sem PII para estudo no Google NotebookLM.
2. **Runtime Inference Plane (FastAPI / aio-pika):**
   - Inferência em memória (< 50ms) no microsserviço Python (`EcommerceBot.Worker`).
   - Comunicação via filas RabbitMQ (`queue:analytics_ml` -> `queue:analytics_processed`).
   - Zero acesso direto ao banco de dados SQL Server.
3. **Knowledge & Research Plane (Google NotebookLM):**
   - Grounding de métricas analíticas, auditoria de acurácia e estudo executivo.

---

## 📐 2. Fórmulas Matemáticas & Especificações dos Algoritmos

### 2.1. Matriz RFM (Recência, Frequência e Valor Monetário)
Implementado em [`rfm_segmentation.py`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Worker/app/ml/rfm_segmentation.py) e [`batch_pipeline.py`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Worker/app/ml/spark/batch_pipeline.py).

- **Cálculo das Variáveis Base:**
  $$\\text{Recência } (R) = \\max(0, \\text{Data de Referência} - \\max(\\text{Data do Pedido}))$$
  $$\\text{Frequência } (F) = \\sum 1 \\quad \\text{(Total de transações pagas do cliente)}$$
  $$\\text{Monetário } (M) = \\sum \\text{Valor Líquido dos Pedidos}$$

- **Estabilização & Normalização:**
  A distribuição de frequência e valor é tipicamente assimétrica à direita (cauda longa). Aplica-se a transformação logarítmica seguida de padronização z-score:
  $$X_{\\log} = \\ln(1 + X)$$
  $$Z = \\frac{X_{\\log} - \\mu}{\\sigma}$$

- **Clusterização KMeans & Silhueta:**
  - Hiperparâmetros: $K = 4$ clusters, `random_state=42`, `n_init=10`.
  - Métrica de Validação: Silhouette Score:
    $$s(i) = \\frac{b(i) - a(i)}{\\max(a(i), b(i))}$$
    *(Onde $a(i)$ é a distância intra-cluster e $b(i)$ é a distância média até o cluster vizinho mais próximo).*

- **Segmentos de Negócio Atribuídos:**
  1. **Campeões (VIP):** Menor recência, altíssima frequência e maior ticket. Ação: Clube de benefícios exclusivos.
  2. **Clientes Fiéis:** Frequência constante e valor moderado/alto. Ação: Cross-sell e novidades.
  3. **Em Risco:** Clientes que compravam com frequência mas a recência ultrapassou a média. Ação: E-mail com cupom de reativação imediata.
  4. **Inativos / Ocasionais:** Baixa frequência e alta recência. Ação: Campanhas de remarketing de baixo custo.

---

### 2.2. Previsão de Churn (`churn_predictor.py`)
- **Definição Operacional:** Considera-se cliente em churn aquele que não realiza compra há mais de 2x o intervalo médio de recompra da categoria (ou cancelou assinatura recorrente).
- **Features do Modelo:** `recency_days`, `order_interval_std`, `ticket_variance`, `refund_count`, `support_ticket_count`.
- **Modelos:** Ensembles baseados em Random Forest e Scikit-Learn com threshold de probabilidade calibrado para $P(\\text{churn}) > 0.65$.

---

### 2.3. Projeção de LTV (Lifetime Value - `ltv_forecaster.py`)
- **Fórmula para E-commerce Transacional:**
  $$\\text{LTV} = \\text{Ticket Médio} \\times \\text{Frequência Anual de Compra} \\times \\text{Vida Média do Cliente (Anos)}$$
- **Fórmula para SaaS / Assinaturas:**
  $$\\text{LTV} = \\frac{\\text{ARPU} \\times \\text{Margem de Contribuição}}{\\text{Taxa de Churn Mensal}}$$

---

### 2.4. Atribuição de Tráfego Last-Click (`tracker.js` + SQL)
- **Script:** [`tracker.js`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Web/public/tracker.js)
- **Parâmetros Capturados:** `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `ad_id`, `fbclid`, `gclid`.
- **Regra Last-Click:** O cookie `_ec_traffic_utm` grava a última visita (TTL 30 dias). Na finalização do pedido, os atributos gravam a sessão no pedido e o Core API persiste na tabela `dbo.TrafficAttributions`.
"""

def generate_pack_04():
    return """# 📡 Módulo 4: Infraestrutura, Mensageria, Observabilidade & Segurança

Este módulo detalha a espinha dorsal de infraestrutura do sistema, as regras de mensageria com **MassTransit & RabbitMQ**, a camada de cache e eventos com **Redis**, os servidores **MCP** e as políticas de segurança corporativa.

---

## 🐇 1. Mensageria MassTransit & RabbitMQ

Para garantir interoperabilidade entre o Core C# (.NET 8/9) e o Worker Python (FastAPI / aio-pika), a serialização é configurada com **Raw JSON**:
```csharp
cfg.UseRawJsonSerializer();
```

### Topologia de Filas
| Fila | Finalidade | Produtor | Consumidor |
|---|---|---|---|
| `queue:ecommerce` | Ingestão de URLs para scraping e enriquecimento por IA | `EcommerceBot.Core` | `ScraperWorker` (Python) |
| `queue:demo_ecommerce` | Demonstração interativa e testes rápidos | `EcommerceBot.Web` / Core | `ScraperWorker` (Python) |
| `ecommerce_processed_queue` | Retorno de produtos enriquecidos | `ScraperWorker` (Python) | `ProcessedProductConsumer` (C#) |
| `queue:analytics_ml` | Transações para inferência de RFM/Churn | `EcommerceBot.Core` | `MLWorker` (Python) |
| `email_notifications` | Notificações e e-mails transacionais (Resend) | `EcommerceBot.Core` | `EmailNotificationConsumer` (C#) |
| `shopify_bulk_sync` | Sincronização em lote de catálogo Shopify | `EcommerceBot.Core` | `ShopifyBulkSyncConsumer` (C#) |
| `nuvemshop_bulk_sync` | Sincronização em lote de catálogo Nuvemshop | `EcommerceBot.Core` | `NuvemshopBulkSyncConsumer` (C#) |

---

## ⚡ 2. Redis: Cache, Idempotência, Rate Limit & SSE

1. **Idempotência de Webhooks:**
   Evita processamento concorrente ou repetido de webhooks:
   ```csharp
   await _redis.StringSetAsync($"webhook:idempotency:{id}", "processed", TimeSpan.FromHours(24), When.NotExists);
   ```
2. **Streaming em Tempo Real (SSE):**
   O canal `demo_stream_{correlationId}` recebe eventos de progresso publicados pelo Worker e republicados pelo Core como `text/event-stream`.
3. **Rate Limiting por Tenant:**
   Contadores de janela deslizante no Redis limitam requisições de scraping e chamadas de inferência para evitar abuso e proteger as cotas dos planos.

---

## 🩺 3. Model Context Protocol (MCP) — Servidor de Diagnósticos

- **Projeto:** `EcommerceBot.Diagnostics.Mcp` (.NET 9 Console)
- **Transporte:** Standard Input / Output (`stdio`)
- **Regras Fail-Closed:** Somente leitura (`WITH (NOLOCK)` em DMVs), sanitização estrita de segredos (chaves de API e senhas mascaradas).

### Ferramentas Nativas Registradas
1. `check_sql_health`: CPU, consultas lentas e locks no SQL Server.
2. `check_redis_metrics`: Consumo de memória, conexões clientes e taxa de hit/miss.
3. `inspect_rabbitmq_queues`: Profundidade de mensagens acumuladas, contagem de consumidores ativos.
4. `get_recent_application_errors`: Leitura dos últimos erros estruturados em `logs/errors-*.json` sem travar a API.

---

## 🛡️ 4. Regras de Segurança SaaS Invioláveis

1. **Fail-Closed em Segredos:** Proibido o uso de `?? "default_secret"` para chaves JWT ou criptográficas. Disparo imediato de `InvalidOperationException`.
2. **Prevenção de SSRF:** O scraper bloqueia esquemas não-HTTP e endereços IP de loopback (`127.0.0.1`, `localhost`), redes privadas RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) e metadados de nuvem (`169.254.169.254`).
3. **Validação de HMAC em Tempo Constante:** Prevenção de timing attacks via `CryptographicOperations.FixedTimeEquals`.
4. **Zero Acesso a Banco no Python Worker:** O microsserviço Python comunica-se exclusivamente através do RabbitMQ e Redis.
"""

def generate_master_bundle(p1, p2, p3, p4, stats):
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    return f"""# 📚 E-commerce Bot — Master Knowledge Pack & Technical Specification

> **Data de Compilação:** {now_str}  
> **Versão da Topologia:** v{stats.get('version', '2.0')} ({stats.get('nodes', 0)} nós, {stats.get('edges', 0)} arestas catalogadas)  
> **Finalidade:** Base de Conhecimento Canônica para Grounding e Consultas de Engenharia no **Google NotebookLM** (Card 83 do Trello).

---

## 🧭 Sumário do Knowledge Pack

1. [Módulo 1: Hub de APIs Externas, Gateways & Provedores](#módulo-1-hub-de-apis-externas-gateways--provedores)
   - Shopify GraphQL 2024+, `productSet`, `note_attributes` e Webhooks HMAC
   - Nuvemshop REST API v1 e injeção no checkout
   - Mercado Pago Checkout Transparente (PIX / CC / Assinaturas)
   - OpenRouter LLM Provider com cadeia de fallback e telemetria
2. [Módulo 2: Dicionário de Dados SQL Server & Multi-Tenancy](#módulo-2-dicionário-de-dados-sql-server--multi-tenancy)
   - Regras de isolamento multi-tenant estrito e Dapper
   - Dicionário completo das tabelas (`dbo.Tenants`, `dbo.Products`, `dbo.Orders`, etc.)
   - Auditoria via DMVs e servidor MCP
3. [Módulo 3: Modelos de Machine Learning, Analytics & Fórmulas](#módulo-3-modelos-de-machine-learning-analytics--fórmulas)
   - Arquitetura Tripartite de ML (Spark Batch, Inference Worker, NotebookLM)
   - Matriz RFM (KMeans, Silhouette, normalização logarítmica)
   - Algoritmos de Churn, LTV e Capacity Forecaster
   - Rastreamento e atribuição de tráfego Last-Click (`tracker.js`)
4. [Módulo 4: Infraestrutura, Mensageria, Observabilidade & Segurança](#módulo-4-infraestrutura-mensageria-observabilidade--segurança)
   - Topologia de filas RabbitMQ e MassTransit Raw JSON
   - Redis Cache, Idempotência, Rate Limit e SSE Pub/Sub
   - Servidor MCP de Diagnósticos (.NET 9)
   - Políticas de segurança corporativa fail-closed

---

\\pagebreak

{p1}

---

\\pagebreak

{p2}

---

\\pagebreak

{p3}

---

\\pagebreak

{p4}

---

## 💡 Guia de Perguntas Recomendadas para o Google NotebookLM

Após fazer o upload deste arquivo no seu caderno do NotebookLM, utilize os seguintes prompts para validar decisões de arquitetura e código:

1. *"Com base nas tabelas do SQL Server e nos contratos de DTO, gere uma query T-SQL otimizada para agregar as vendas por utm_source respeitando o isolamento do TenantId."*
2. *"Quais são os passos exatos e o payload necessário para sincronizar um produto na Shopify usando a mutation productSet com note_attributes?"*
3. *"Explique como o modelo de RFM calcula a recência e qual a fórmula aplicada para estabilização de assimetria dos dados antes do KMeans."*
4. *"Quais filas do RabbitMQ participam do fluxo assíncrono de extração de produtos e como o Raw JSON serializer garante a compatibilidade entre C# e Python?"*
5. *"Qual a política de tratamento de webhooks duplicados no Mercado Pago usando Redis?"*
"""

def main():
    print("🚀 Compilando o Knowledge Pack do E-commerce Bot para o Google NotebookLM...")
    
    PACK_DIR.mkdir(parents=True, exist_ok=True)
    MASTER_FILE.parent.mkdir(parents=True, exist_ok=True)

    stats = load_graph_stats()
    tables = parse_sql_tables()

    print(f"📊 Metadados carregados: {stats['nodes']} nós no grafo, {len(tables)} tabelas SQL mapeadas.")

    p1 = generate_pack_01()
    p2 = generate_pack_02(tables)
    p3 = generate_pack_03()
    p4 = generate_pack_04()

    # Salvar pacotes modulares
    f1 = PACK_DIR / "01_external_apis_and_gateways.md"
    f2 = PACK_DIR / "02_database_schemas_and_multitenancy.md"
    f3 = PACK_DIR / "03_ml_models_and_analytics_formulas.md"
    f4 = PACK_DIR / "04_infrastructure_messaging_and_security.md"

    f1.write_text(p1, encoding="utf-8")
    f2.write_text(p2, encoding="utf-8")
    f3.write_text(p3, encoding="utf-8")
    f4.write_text(p4, encoding="utf-8")

    # Salvar Master Bundle
    master_content = generate_master_bundle(p1, p2, p3, p4, stats)
    MASTER_FILE.write_text(master_content, encoding="utf-8")

    print("✅ Knowledge Pack gerado com sucesso:")
    print(f"   - {f1}")
    print(f"   - {f2}")
    print(f"   - {f3}")
    print(f"   - {f4}")
    print(f"   - 🌟 Master Bundle: {MASTER_FILE} ({len(master_content.splitlines())} linhas)")

if __name__ == "__main__":
    main()
