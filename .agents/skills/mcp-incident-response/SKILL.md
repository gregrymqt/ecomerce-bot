---
name: mcp-incident-response
description: "Playbook canônico e determinístico de triagem, diagnóstico e resolução de incidentes em runtime via servidores MCP (ecommercebot-diagnostics em C# e ecommercebot-scraper-worker em Python). Impõe coleta prévia de evidências via stdio, consulta a runbooks (resource://runbooks/*) e Root Cause Analysis (RCA) antes de qualquer modificação de código."
---

# 🩺 MCP Incident Response & Runtime Diagnostics — Playbook Canônico

Este documento estabelece o protocolo operacional determinístico para diagnóstico, triagem e resolução de falhas em tempo de execução no ecossistema **E-commerce Bot**.

---

## 🚨 1. Diretriz de Ativação Mandatória (Fail-Closed)

Diante de qualquer sintoma de erro em runtime reportado (erro HTTP 500, exceções no C#, timeouts ou locks no SQL Server, filas represadas no RabbitMQ, falhas no Redis ou bloqueios 403/Cloudflare no Scraper Python):

> **É TERMINANTEMENTE PROIBIDO propor palpites, suposições ou editar arquivos de código-fonte sem antes coletar evidências através das ferramentas MCP correspondentes.**

### Anti-Padrões Proibidos:
- ❌ Editar código-fonte na tentativa de "adivinhar" o erro sem evidência de log ou telemetria.
- ❌ Pedir para o usuário rodar comandos manuais de inspeção no terminal quando existe ferramenta MCP.
- ❌ Tentar executar comandos de escrita (`INSERT`, `UPDATE`, `FLUSHDB`, `DROP`) via ferramentas de diagnóstico.

---

## 🛠️ 2. Inventário dos Servidores MCP do Ecossistema (Transporte stdio)

O ecossistema opera sob dois servidores MCP complementares via **Standard I/O (`stdio`)**, sem portas de rede e sem túneis HTTP externos:

```text
                               ┌────────────────────────────────────────┐
                               │  Agente IA / IDE (Cursor / Antigravity)│
                               └───────┬────────────────────────▲───────┘
                                       │                        │
                    stdio (JSON-RPC 2.0)                        │ stdio (FastMCP)
                                       │                        │
                                       ▼                        │
          ┌────────────────────────────────────────┐  ┌─────────┴──────────────────────────────┐
          │ Servidor 1: ecommercebot-diagnostics   │  │ Servidor 2: ecommercebot-scraper-worker │
          │ Stack: C# (.NET 9 Console App)         │  │ Stack: Python 3.13 (FastMCP)            │
          │ Local: EcommerceBot.Diagnostics.Mcp/   │  │ Local: EcommerceBot.Worker/mcp_server.py│
          └────────────────────────────────────────┘  └────────────────────────────────────────┘
```

### 2.1. Servidor C# (`ecommercebot-diagnostics`)
Especializado na camada transacional, persistência, mensageria e artefatos de IA/ML:
- `get_recent_application_errors(hours, level, limit)`: Inspeciona logs estruturados Serilog (`logs/errors-*.json`).
- `check_sql_health()`: Diagnostica locks, bloqueios ativos e conexões no SQL Server 2022 via DMVs com `WITH (NOLOCK)`.
- `inspect_rabbitmq_queues(queuePrefix)`: Analisa profundidade de filas, mensagens sem confirmação (`unacked`) e consumidores ativos.
- `check_redis_metrics()`: Checa consumo de memória, taxa de acerto (`hit rate`), conexões e integridade do cache/locks.
- `inspect_ml_artifacts(modelName)`: Analisa integridade física de arquivos `.joblib` e metadados de calibração RFM/Churn.
- `check_spark_pipeline_status()`: Valida o estado dos pipelines em lote Spark e relatórios analíticos gerados.

#### Runbooks Operacionais Integrados (`resource://runbooks/*`):
- `resource://runbooks/sql-server-diagnostics`: Guia de análise de DMVs, page splits, locks e planos de execução.
- `resource://runbooks/rabbitmq-troubleshooting`: Guia de desobstrução de filas, dead-letter exchanges e throttling.
- `resource://runbooks/ml-spark-notebooklm`: Arquitetura do pipeline tripartite e sincronização com o Google NotebookLM.
- `resource://ml/latest-metrics`: Último relatório de saúde preditiva e segmentação RFM gerado pelo motor analítico.

### 2.2. Servidor Python (`ecommercebot-scraper-worker`)
Especializado na borda de scraping perimetral e extração de dados:
- `test_scrape_url(url)`: Execução isolada (*dry-run*) com validação Anti-SSRF. Zero escrita no Redis, zero eventos no RabbitMQ.
- `read_scraper_logs(lines, filter_query)`: Leitura rotacionada de `logs/scraper_worker.log` com filtro textual (`403`, `timeout`, `SKU`).
- `check_scraper_health()`: Checagem local de prontidão dos motores de extração (`Scrapling`, `Camoufox`, `BeautifulSoup`, `html2text`).

---

## 🧭 3. Matriz de Triagem por Sintoma

| Sintoma Observado / Reportado | Servidor MCP | Ferramenta Inicial | Próximo Passo / Recurso |
|---|---|---|---|
| **Erro HTTP 500 / Exceção C#** | `ecommercebot-diagnostics` | `get_recent_application_errors(hours=1, level="Error")` | Inspecionar stack trace Serilog e correlacionar rota/TenantId |
| **Lentidão / Timeout no SQL Server** | `ecommercebot-diagnostics` | `check_sql_health()` | Ler `resource://runbooks/sql-server-diagnostics` se houver bloqueios |
| **Mensagens travadas / Fila lenta** | `ecommercebot-diagnostics` | `inspect_rabbitmq_queues()` | Ler `resource://runbooks/rabbitmq-troubleshooting` se `unacked > 0` |
| **Erro de Rate Limit / Lock no Redis** | `ecommercebot-diagnostics` | `check_redis_metrics()` | Avaliar consumo de memória e chave de rate limit |
| **Bloqueio 403 / Cloudflare no Scraping** | `ecommercebot-scraper-worker` | `read_scraper_logs(filter_query="403")` | Executar `test_scrape_url(url)` para verificar evasão |
| **Falha de Extração de Dados do Produto** | `ecommercebot-scraper-worker` | `test_scrape_url(url)` | Inspecionar JSON-LD, seletores CSS e fallback para Markdown |
| **Inconsistência nos Clusters de IA/ML** | `ecommercebot-diagnostics` | `inspect_ml_artifacts(modelName="rfm_pipeline")` | Ler `resource://runbooks/ml-spark-notebooklm` |

---

## 🔄 4. Ciclo Canônico de Resolução em 4 Fases

```text
 ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
 │     FASE 1      │       │     FASE 2      │       │     FASE 3      │       │     FASE 4      │
 │  Coleta MCP     │ ────> │  Consulta ao    │ ────> │ Bloco de RCA    │ ────> │ Correção Mínima │
 │  de Evidências  │       │  Runbook MCP    │       │ Estruturado     │       │ & Verificação   │
 └─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘
```

### Fase 1: Coleta de Evidência Read-Only
Acione a ferramenta MCP correspondente. Obtenha os dados reais de runtime antes de consultar o código-fonte.

### Fase 2: Consulta a Runbooks Operacionais
Se o incidente envolver banco de dados, mensageria ou pipeline analítico, leia o runbook correspondente via `read_resource("resource://runbooks/...")`.

### Fase 3: Apresentação do RCA Estruturado
Antes de propor ou aplicar qualquer modificação de código, apresente obrigatoriamente o bloco de Root Cause Analysis:

```markdown
### 🔍 Root Cause Analysis (RCA)
- **Sintoma Reportado:** Descrição objetiva da falha observada.
- **Ferramenta MCP Acionada & Evidência Bruta:** Nome da ferramenta chamada e dados essenciais extraídos.
- **Runbook Consultado:** URI do runbook MCP utilizado para balizar o diagnóstico.
- **Causa Raiz Identificada:** Diagnóstico inequívoco baseado nos fatos coletados.
- **Ação Cirúrgica Proposta:** Modificação mínima estritamente necessária no código ou configuração.
```

### Fase 4: Aplicação Cirúrgica e Validação Sanitária
1. Aplique a alteração mínima no código respeitando Clean Architecture, Dapper tipado e as regras do `AGENTS.md`.
2. Valide a resolução:
   - Se for scraping: execute `test_scrape_url(url)` via MCP para comprovar extração bem-sucedida.
   - Se for mensageria: inspecione `inspect_rabbitmq_queues` para confirmar consumo de mensagens represadas.
   - Se for backend C# ou testes: execute a suíte de testes unitários relevante via terminal sanitizado.

---

## 🔒 5. Regras de Segurança & Fail-Closed

1. **Estrita Leitura (*Read-Only*):** Ferramentas MCP NUNCA devem executar comandos de escrita T-SQL (`EXEC`, `INSERT`, `UPDATE`, `DELETE`, `DROP`) ou comandos destrutivos no Redis (`FLUSHALL`, `FLUSHDB`).
2. **Anti-SSRF Rigoroso:** O teste de URLs no scraper executa validação prévia de IP e esquema, bloqueando RFC 1918, loopbacks e metadados de nuvem.
3. **Transporte Local:** A comunicação ocorre exclusivamente através de `stdio`. É proibido configurar servidores MCP via portas de rede ou túneis externos na máquina do desenvolvedor.
4. **Governança de Tamanho:** Este arquivo de skill e todos os arquivos alterados devem respeitar o teto de **no máximo 350 linhas de código**.
