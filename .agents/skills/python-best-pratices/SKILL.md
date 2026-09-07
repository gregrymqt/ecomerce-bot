---
name: python-best-practices
description: "Diretrizes obrigatórias de arquitetura, padrões Python 3.10+, Clean/Hexagonal Architecture, concorrência assíncrona (FastAPI/asyncio), mensageria (RabbitMQ/aio-pika), cache/locks (Redis), inferência ML, Jinja2 templates e observabilidade para o backend worker (EcommerceBot.Worker)."
---

# 🐍 Skill: Padrões de Arquitetura & Diretrizes de Python Worker

---

## 1. Visão Geral e Propósito

Este documento define os padrões canônicos de arquitetura, concorrência assíncrona, modelagem, mensageria e observabilidade para microsserviços desenvolvidos em Python no ecossistema **E-commerce Bot** — com foco estrito no microsserviço assíncrono `EcommerceBot.Worker`.

> [!IMPORTANT]
> **FAIL-CLOSED (Regra 2 do AGENTS.md):**
> O `EcommerceBot.Worker` **NUNCA** deve importar bibliotecas de banco de dados relacional (`sqlalchemy`, `databases`, `psycopg`, `psycopg2`, `asyncpg`, `pyodbc`, `pymssql`, `tortoise-orm`). Sua comunicação e persistência operacional são estritamente efetuadas através de **RabbitMQ** e **Redis**.

---

## 2. Padrões de Arquitetura e Organização de Domínio

### 2.1. Separação em Camadas e Bounded Contexts

Em sistemas corporativos, a organização clássica centrada puramente no framework (pastas como `views/`, `controllers/`, `models/` globais) degrada rapidamente à medida que o serviço cresce. A abordagem canônica baseia-se em **Clean / Hexagonal Architecture** combinada a **Bounded Contexts** do Domain-Driven Design (DDD):

- **Domain (Núcleo Puro):** Entidades de negócio, Value Objects e exceções de domínio. Deve ser independente de bibliotecas de terceiros, brokers externos ou frameworks HTTP.
- **Application / Use Cases:** Orquestração dos fluxos de trabalho (casos de uso). Coordena entidades, processa mensagens recebidas de filas, aciona rotinas de IA/ML e interage com contratos/interfaces abstratas.
- **Infrastructure:** Implementações concretas de clientes de mensageria (`aio-pika`), cache e locks (`redis-py`), clientes HTTP resilientes (`httpx`, `curl_cffi`), motores de extração (`scrapling`) e carregamento de modelos preditivos (`scikit-learn`, `joblib`).
- **Presentation / Ingestion:** Routers e endpoints da API interna (`FastAPI`), handlers/consumers de filas RabbitMQ, schemas de entrada/saída Pydantic e serializers.

#### Estrutura Canônica de Diretórios (`EcommerceBot.Worker`)

```text
EcommerceBot.Worker/
├── app/
│   ├── core/                   # Configurações globais, RabbitMQ, Redis, segurança
│   │   ├── config/             # Settings fortemente tipadas (Pydantic Settings)
│   │   └── shared/             # Utilitários globais, anti-SSRF, criptografia
│   ├── ai/                     # LLM Engine Router (OpenRouter Fallback, prompts)
│   ├── ml/                     # Inferência Scikit-Learn (RFM, Churn, LTV) & Consumers
│   ├── scraper/                # ScraperWorker (JSON-LD + Scrapling + anti-SSRF)
│   ├── templates/              # Templates de e-mail Jinja2 (.html com autoescape)
│   └── main.py                 # FastAPI app, lifespan assíncrono e health checks
├── tests/                      # Testes unitários e de integração assíncronos (pytest)
├── requirements.txt            # Dependências fixadas (sem drivers de banco relacional)
└── Dockerfile                  # Containerização otimizada para execução assíncrona
```

---

### 2.2. Abstrações Pythonicas com `typing.Protocol`

Em vez de depender fortemente de herança com classes base abstratas (`abc.ABC`), adote o polimorfismo estrutural (*duck typing estático*) via `typing.Protocol`. Isso permite desacoplar a camada de aplicação da infraestrutura concreta:

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class MessagePublisher(Protocol):
    """Contrato abstrato para publicação de mensagens em brokers assíncronos."""
    async def publish(self, routing_key: str, payload: dict) -> None: ...

@runtime_checkable
class CacheProvider(Protocol):
    """Contrato abstrato para operações de cache e coordenação efêmera."""
    async def get(self, key: str) -> str | None: ...
    async def set(self, key: str, value: str, ttl_seconds: int) -> None: ...
```

Na injeção de dependências em rotas FastAPI ou handlers modulares, utilize o sistema nativo `Depends()`, encadeando dependências assíncronas especializadas e garantindo que cada fluxo receba apenas os contratos necessários.

---

## 3. Escrita de Código Moderna e Rigor de Tipagem

### 3.1. Tipagem Estática e Ferramental Moderno

- **Checagem Estática Rígida:** O uso de tipagem em Python é indispensável para sistemas de grande escala. Configure o Mypy ou Pyright em modo estrito (`strict = true`), proibindo variáveis não tipadas (`Any` implícito) e garantindo cobertura total de tipos em funções e métodos.
- **Sintaxe Moderna (Python 3.10+):**
  - Utilize uniões nativas (`T | None` em vez de `Optional[T]`).
  - Utilize `TypeAlias` ou a declaração `type` para apelidos semânticos.
  - Empregue `typing.Self` para retornos de métodos fluentes.
- **Linter e Formatação Unificada:** Adote o **Ruff**. Escrito em Rust, ele substitui simultaneamente Flake8, Black, isort, pydocstyle e bandit com execução até 100x mais rápida, padronizando o código em pipelines de CI/CD.

---

### 3.2. Modelagem de Dados: DTOs vs. Value Objects

- **Pydantic V2 para Fronteiras Externas:** Utilize Pydantic para validação e coerção de dados de entrada na camada de apresentação/mensageria (`schemas.py`) e para configurações de ambiente (`pydantic-settings`). O núcleo em Rust do Pydantic V2 oferece alta performance em validação.
- **`dataclasses(slots=True, frozen=True)` para o Domínio:** No núcleo do domínio e em representações internas de dados, prefira dataclasses congeladas nativas do Python com `slots=True`. Elas eliminam a criação do dicionário de atributos interno (`__dict__`), reduzindo a pegada de memória em até 40% e impedindo mutações acidentais em Value Objects.

```python
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class Money:
    amount: int  # Representação em centavos para evitar imprecisão de ponto flutuante
    currency: str
```

---

### 3.3. Hierarquia de Exceções e Respostas RFC 7807

Nunca utilize exceções genéricas (`raise Exception(...)`) ou blocos silenciosos (`except Exception: pass`). Estruture uma árvore clara de erros de domínio e delegue a conversão para HTTP a um tratador global:

```python
# domain/exceptions.py
class DomainError(Exception):
    """Exceção base de regras de negócio."""

class EntityNotFoundError(DomainError):
    def __init__(self, entity_name: str, entity_id: str):
        super().__init__(f"{entity_name} com identificador '{entity_id}' não foi encontrado.")

class ExtractionFailedError(DomainError):
    def __init__(self, target_url: str, reason: str):
        super().__init__(f"Falha na extração de dados para '{target_url}': {reason}")
```

```python
# presentation/exception_handlers.py
from fastapi import Request
from fastapi.responses import JSONResponse

async def domain_exception_handler(request: Request, exc: DomainError) -> JSONResponse:
    status_code = 404 if isinstance(exc, EntityNotFoundError) else 400
    return JSONResponse(
        status_code=status_code,
        headers={"Content-Type": "application/problem+json"},
        content={
            "type": "https://errors.api.internal/domain-error",
            "title": "Violação de Regra de Negócio",
            "status": status_code,
            "detail": str(exc),
            "instance": request.url.path,
        },
    )
```

---

## 4. Engenharia de Execução, Concorrência e Servidores ASGI

### 4.1. A Regra Fundamental do Event Loop

Python assíncrono opera sob um modelo cooperativo de thread única por processo com um loop de eventos (`asyncio`). A falha de maior impacto em produção é introduzir bloqueios síncronos dentro de rotinas assíncronas:

- **Rotas e Handlers Assíncronos (`async def`):** O servidor executa o código diretamente no loop de eventos principal. Qualquer operação bloqueante de I/O (ex: `requests.get()`, `time.sleep()`, chamadas síncronas de rede) congela o loop inteiro, impedindo o atendimento de todas as outras mensagens e requisições concorrentes.
- **Rotas Síncronas (`def`):** No FastAPI, rotas convencionais `def` são automaticamente despachadas para um pool de threads gerenciado (`anyio.to_thread`), isolando o I/O bloqueante do loop.
- **Descarregamento Forçado:** Se for obrigatório utilizar uma biblioteca externa estritamente síncrona dentro de um fluxo assíncrono, descarregue-a explicitamente para a threadpool:

```python
import asyncio

# Delegação explícita para threadpool gerenciada sem travar o event loop principal
result = await asyncio.to_thread(legacy_sync_blocking_function, arg1, timeout=10)
```

---

### 4.2. Tratamento de Tarefas CPU-Bound e Mitigação do GIL

O *Global Interpreter Lock* (GIL) do CPython restringe a execução de bytecode a uma única thread por vez. Em rotinas com alta demanda computacional (inferência matricial pesada, processamento de tensores, cálculos estatísticos densos), o uso de threads não surte efeito de paralelismo real:

- **`ProcessPoolExecutor`:** Utilize múltiplos processos para contornar o GIL e distribuir a carga entre os núcleos físicos de CPU.
- **Extensões Nativas:** Delegue rotinas de alto processamento para extensões compiladas em C, C++ ou Rust (como NumPy, Scikit-Learn, Polars), que liberam o GIL durante seus cálculos matemáticos internos.

---

### 4.3. Servidores ASGI em Produção: Uvicorn vs. Granian

- **Uvicorn (com `uvloop` e `httptools`):** É o padrão consolidado da indústria. Apresenta alta maturidade e excelente compatibilidade com todo o ecossistema Python assíncrono. Em produção, opera comumente sob o Gunicorn como gerenciador de processos (`gunicorn -k uvicorn.workers.UvicornWorker`).
- **Granian:** Servidor moderno construído em Rust sobre a biblioteca Hyper. Oferece suporte a WSGI, ASGI e RSGI, apresentando latências mais baixas e menor pegada de memória sob alta concorrência.
- **Dimensionamento de Workers:** Diferente de aplicações puramente síncronas em WSGI (fórmula de $2 \times \text{cores} + 1$), servidores assíncronos gerenciam milhares de conexões em cada loop. Recomenda-se alocar entre **1 a 2 workers assíncronos por núcleo físico de CPU dedicado ao contêiner**, evitando overhead excessivo de chaveamento de processos no sistema operacional.

---

### 4.4. Otimização de Serialização JSON

A biblioteca padrão `json` do Python introduz custos elevados de serialização em payloads volumosos de e-commerce e filas. Em rotinas de alta vazão, adote substitutos em C/Rust:

- **`orjson`:** O serializador JSON mais rápido para Python, suportando nativamente objetos `dataclass`, `datetime` e `UUID` sem overhead de conversão intermediária.
- **`msgspec`:** Biblioteca de alto desempenho que combina validação estrutural com serialização binária e JSON com alocações quase nulas de memória.

---

## 5. Mensageria Assíncrona e RabbitMQ (`aio-pika`)

O `EcommerceBot.Worker` consome e processa mensagens assíncronas do ecossistema a partir de filas RabbitMQ (`queue:ecommerce`, `queue:analytics_ml`, etc.).

### 5.1. Topologia Declarativa e Consumers Resilientes

- **`aio-pika` Assíncrono:** Utilize sempre conexões e canais assíncronos (`aio_pika.connect_robust`).
- **Idempotência de Processamento:** Cada mensagem processada deve verificar no Redis se o identificador (`message_id` ou hash do payload) já foi executado nas últimas 24 horas via `SET NX`.
- **Dead Letter Exchanges (DLQ):** Toda fila deve ser configurada com `x-dead-letter-exchange` para capturar falhas irrecuperáveis após limite de retentativas, impedindo o envenenamento da fila (*poison pill*).
- **Serialização Raw JSON:** O monorepo adota `RawJsonSerializer` no C# MassTransit. O worker Python deve ler e escrever mensagens como JSON UTF-8 puro, sem wrappers de envelopes binários legados.

```python
import aio_pika
import orjson
import logging

logger = logging.getLogger(__name__)

async def process_incoming_message(message: aio_pika.IncomingMessage) -> None:
    async with message.process(requeue=False):
        try:
            payload = orjson.loads(message.body)
            # Processa o caso de uso assíncrono
            logger.info("Mensagem recebida com sucesso", extra={"routing_key": message.routing_key})
        except Exception as exc:
            logger.error(f"Erro fatal ao processar mensagem: {exc}", exc_info=True)
            # Ao sair do bloco com requeue=False após erro, a mensagem é direcionada para a DLQ
            raise
```

### 5.2. Ciclo de Vida do Worker via `lifespan`

O gerenciamento de inicialização e desligamento gracioso (*graceful shutdown*) deve ser centralizado no gerenciador de contexto `lifespan` do FastAPI:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicialização: conexões, provisionamento de filas e criação de tasks em background
    connection = await get_rabbitmq_connection()
    worker_tasks = [
        asyncio.create_task(start_scraper_worker(), name="worker_scraper"),
        asyncio.create_task(consume_ml_queue(), name="worker_ml"),
    ]
    app.state.worker_tasks = worker_tasks
    yield
    # Finalização: cancelamento de tasks e drenagem graciosa
    for task in worker_tasks:
        task.cancel()
    await asyncio.gather(*worker_tasks, return_exceptions=True)
    await connection.close()
```

---

## 6. Persistência Efêmera, Caching e Locks Distribuídos com Redis

No `EcommerceBot.Worker`, a persistência operacional (resultados temporários, deduplicação e controle de concorrência) reside estritamente no Redis.

### 6.1. Proteção Contra Cache Stampede (SafeCache)

Quando dados frequentemente requisitados expiram de uma só vez, centenas de requisições ou workers simultâneos tentam recalcular o valor. Adote contenção com `asyncio.Lock` local e lock distribuído no Redis, complementado por **Jitter** na expiração do TTL:

```python
import asyncio
import random
from typing import Callable, Awaitable
import redis.asyncio as aioredis

class SafeCache:
    def __init__(self, redis_client: aioredis.Redis):
        self._redis = redis_client
        self._locks: dict[str, asyncio.Lock] = {}

    async def get_or_compute(
        self,
        key: str,
        compute_fn: Callable[[], Awaitable[str]],
        base_ttl: int = 300,
    ) -> str:
        # Fast path (leitura sem contenção)
        val = await self._redis.get(key)
        if val is not None:
            return val.decode("utf-8") if isinstance(val, bytes) else str(val)

        lock = self._locks.setdefault(key, asyncio.Lock())
        async with lock:
            # Double-check após adquirir o lock
            val = await self._redis.get(key)
            if val is not None:
                return val.decode("utf-8") if isinstance(val, bytes) else str(val)

            # Executa a computação pesada apenas uma vez
            result = await compute_fn()

            # Aplica Jitter (variação de até 10%) para suavizar a janela de expiração
            jitter = random.randint(0, max(1, int(base_ttl * 0.1)))
            await self._redis.set(key, result, ex=base_ttl + jitter)
            return result
```

---

## 7. Governança de Templates e E-mails (Jinja2)

> [!IMPORTANT]
> **FAIL-CLOSED (Regra 9 do AGENTS.md):**
> É terminantemente **PROIBIDO** declarar HTML inline ou concatenar strings HTML diretamente no código Python para envio de e-mails ou relatórios.

### 7.1. Regras de Renderização Segura
1. **Localização:** Todo arquivo de template DEVE residir na pasta `EcommerceBot.Worker/app/templates` como arquivo `.html`.
2. **Autoescape Mandatório:** A instância do Jinja2 DEVE ser configurada com `autoescape=True` para neutralizar ataques de Cross-Site Scripting (XSS).
3. **Mecanismo Centralizado:** Utilize exclusivamente a função auxiliar `render_jinja_template(template_name, context)`:

```python
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"

jinja_env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    autoescape=select_autoescape(["html", "xml"]),
    trim_blocks=True,
    lstrip_blocks=True,
)

def render_jinja_template(template_name: str, context: dict) -> str:
    """Renderiza um template Jinja2 de forma segura com autoescape obrigatório."""
    template = jinja_env.get_template(template_name)
    return template.render(**context)
```

---

## 8. Scraping Resiliente e Proteção Anti-SSRF

O módulo `ScraperWorker` extrai metadados de produtos (`JSON-LD`, microdados, tags OpenGraph) de lojas virtuais usando `scrapling` e `curl_cffi`.

### 8.1. Proteção Rígida Anti-SSRF (Regra 3.3 do AGENTS.md)
Toda URL submetida para extração de produtos deve ser sanitizada e validada antes de qualquer chamada HTTP de rede:
- **Esquemas permitidos:** Estritamente `http://` e `https://`.
- **Bloqueio de Loopback:** Bloqueio categórico de `127.0.0.0/8`, `localhost` e `::1`.
- **Bloqueio de Redes Privadas (RFC 1918):** Bloqueio estrito de `10.0.0.0/8`, `172.16.0.0/12` e `192.168.0.0/16`.
- **Bloqueio de Metadados de Nuvem:** Bloqueio de endereços de link-local e metadados (`169.254.169.254`, `0.0.0.0`).

```python
import ipaddress
import socket
from urllib.parse import urlparse

def validate_url_safety(target_url: str) -> None:
    parsed = urlparse(target_url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Esquema de URL não permitido: {parsed.scheme}")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("URL sem hostname válido")

    # Resolução DNS e verificação de integridade de IP
    ip_str = socket.gethostbyname(hostname)
    ip = ipaddress.ip_address(ip_str)

    if ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_reserved:
        raise ValueError(f"Acesso a endereço IP privado ou restrito bloqueado (Anti-SSRF): {ip_str}")
```

---

## 9. MLOps e Inferência Assíncrona em Tempo Real

A inferência analítica no `EcommerceBot.Worker` segue a arquitetura tripartite definida na **Seção 9 do AGENTS.md**:

1. **Latência Alvo (< 50ms):** Os modelos pré-treinados (`RFM`, `Churn`, `LTV`) são carregados em memória no início do processo e executados sem I/O de rede síncrono.
2. **Hot-Reload Baseado em `mtime`:** O worker monitora a data de modificação (`mtime`) dos arquivos de artefatos `.joblib` em disco. Ao detectar atualização (sincronizada via script do Cloudflare R2), os pesos são recarregados dinamicamente em memória com zero downtime, sem reiniciar o container.
3. **Zero Acoplamento com Spark e NotebookLM:** O treinamento em lote ocorre fora do worker (Google Spark / PySpark) e a análise de métricas no NotebookLM ocorre offline. O worker em produção apenas executa os binários exportados.

---

## 10. Observabilidade, Logging Estruturado e Telemetria

### 10.1. Logging Estruturado em Formato JSON

A interpolação simples de strings via f-strings (`logger.info(f"Processando {item_id}")`) consome memória na montagem textual e impede indexação precisa em coletores como Datadog, Elasticsearch e Grafana Loki. Adote `structlog` ou `python-json-logger` para emitir eventos estritamente estruturados em JSON:

```python
import logging
from pythonjsonlogger import jsonlogger

logger = logging.getLogger("worker")
handler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter(
    fmt="%(asctime)s %(levelname)s %(name)s %(message)s"
)
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Registra evento com metadados estruturados
logger.info(
    "produto_extraido",
    extra={
        "tenant_id": "tenant-uuid",
        "sku": "PROD-123",
        "tempo_ms": 42.5,
    }
)
```

### 10.2. Health Checks e Diagnóstico

- **`/health` (Liveness):** Valida unicamente se o processo ASGI está vivo e respondendo a requisições de controle. Não deve realizar chamadas a serviços externos.
- **Prontidão (Readiness):** Valida a conectividade ativa com o broker RabbitMQ e com o Redis antes de sinalizar prontidão para orquestradores de containers.
- **Zero Acesso a Banco:** Proibido executar qualquer verificação de banco relacional nos endpoints de health do Python Worker.

---

## 11. Matriz Consolidada de Boas Práticas

| Domínio de Engenharia | Prática Canônica Recomendada | Anti-Padrão a Eliminar |
|---|---|---|
| **Arquitetura & Limites** | Clean Architecture, separação de Bounded Contexts e uso de `typing.Protocol` | Módulos monolíticos misturando regras, workers e rotas sem isolamento |
| **Persistência & Dados** | **Comunicação estritamente via RabbitMQ e Redis** (Zero Banco Relacional) | **Importar SQLAlchemy, asyncpg, psycopg ou criar scripts de banco no Worker** |
| **Modelagem e Tipagem** | Pydantic V2 para schemas I/O; `dataclasses(slots=True)` congeladas para domínio | Uso irrestrito de dicionários primitivos (`dict[str, Any]`) sem tipagem |
| **Concorrência Assíncrona** | `async def` para I/O cooperativo; `asyncio.to_thread` para sync I/O isolado | Chamar rotinas bloqueantes (`requests.get`, `time.sleep`) dentro de funções `async def` |
| **Processamento CPU-Bound** | Execução via `ProcessPoolExecutor` ou bibliotecas compiladas C/Rust (NumPy/Sklearn) | Alocar threads Python convencionais para tarefas pesadas esperando mitigar o GIL |
| **Mensageria & Filas** | Topologia assíncrona `aio-pika`, Raw JSON, Dead Letter Queues e deduplicação Redis | Envelopes binários legados, polling síncrono infinito e processamento sem DLQ |
| **Caching & Coordenação** | `SafeCache` com `asyncio.Lock` local, lock distribuído Redis e Jitter no TTL | Consultas repetitivas sem proteção gerando *Cache Stampede* |
| **Templates de E-mail** | Arquivos `.html` em `app/templates` renderizados via Jinja2 com `autoescape=True` | **Concatenação de strings HTML inline ou f-strings diretamente no código** |
| **Segurança Web / Scraping** | Validação estrita de URLs bloqueando loopback, RFC 1918 e metadados (Anti-SSRF) | Requisitar URLs arbitrárias diretamente sem validação de rede |
| **MLOps & Inferência** | Inferência rápida em memória (< 50ms) com recarregamento a quente via `mtime` | Chamar pipelines de treinamento Spark ou serviços offline de forma síncrona |
| **Logging & Métricas** | Emissão estruturada em JSON (`python-json-logger`/`structlog`) com atributos tipados | Interpolação de f-strings em formato de texto cru nos arquivos de log |