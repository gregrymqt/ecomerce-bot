#!/usr/bin/env python3
"""
.agents/scripts/generate_knowledge_graph.py

Extrator de Topologia e Grafo de Conhecimento do Ecossistema E-commerce Bot.
Analisa de ponta a ponta todos os 4 pilares da plataforma mais a camada de infraestrutura:
  1. Frontend SPA (React 18 + Vite + AppRoutes + Services + Hooks + Chamadas de API)
  2. Backend Transacional Core (ASP.NET Core .NET 9, Controllers, Gateways, Dapper Repositories, Consumers e Producers)
  3. AI/ML Engine Worker (Python FastAPI, ScraperWorker, LLMEngineRouter, ML Models, PySpark, Jinja2 Templates)
  4. Mensageria Assíncrona & Cache (RabbitMQ Queues, DLX/DLQ, MassTransit, Redis SSE Pub/Sub)
  5. Banco de Dados SQL Server 2022 (Tabelas DbUp, Views Diagnósticas, Foreign Keys de Linhagem e RLS)
  6. Observabilidade & SRE (Servidor MCP, Runbooks, Docker Compose, Scripts de Backup R2)

Gera:
  - .agents/graph.json: Mapeamento completo e determinístico de nós e arestas de dependência.
  - .agents/GRAPH_REPORT.md: Sumário executivo denso (< 320 linhas) para navegação sem busca cega.
"""

import os
import re
import sys
import json
from pathlib import Path

# Garante suporte a UTF-8 no stdout/stderr no Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = ROOT_DIR / ".agents"

nodes = []
edges = []

def add_node(node_id: str, label: str, node_type: str, file_path: str = "", metadata: dict = None):
    for existing in nodes:
        if existing["id"] == node_id:
            if metadata:
                existing["metadata"].update(metadata)
            if file_path and not existing.get("file"):
                existing["file"] = str(file_path).replace("\\", "/")
            return
    nodes.append({
        "id": node_id,
        "label": label,
        "type": node_type,
        "file": str(file_path).replace("\\", "/") if file_path else "",
        "metadata": metadata or {}
    })

def add_edge(source: str, target: str, relationship: str):
    edge = {"source": source, "target": target, "relationship": relationship}
    if edge not in edges:
        edges.append(edge)

# ==============================================================================
# 1. BANCO DE DADOS & PERSISTÊNCIA (DbUp Migrations, Views, FKs, RLS)
# ==============================================================================
def scan_sql_migrations():
    migrations_dir = ROOT_DIR / "Database.Migrations" / "Scripts"
    if not migrations_dir.exists():
        return [], [], [], []

    tables = []
    views = []
    policies = []
    foreign_keys = []

    table_pattern = re.compile(r"CREATE\s+TABLE\s+(?:dbo\.)?\[?(\w+)\]?", re.IGNORECASE)
    view_pattern = re.compile(r"CREATE\s+(?:OR\s+ALTER\s+)?VIEW\s+(?:dbo\.)?\[?(\w+)\]?", re.IGNORECASE)
    policy_pattern = re.compile(r"CREATE\s+SECURITY\s+POLICY\s+(?:Security\.)?\[?(\w+)\]?", re.IGNORECASE)
    func_pattern = re.compile(r"CREATE\s+(?:OR\s+ALTER\s+)?FUNCTION\s+(?:Security\.)?\[?(\w+)\]?", re.IGNORECASE)
    fk_pattern = re.compile(r"REFERENCES\s+(?:dbo\.)?\[?(\w+)\]?\s*\(\s*\[?\w+\]?\s*\)", re.IGNORECASE)
    rls_target_pattern = re.compile(r"ON\s+dbo\.\[?(\w+)\]?", re.IGNORECASE)

    for sql_file in sorted(migrations_dir.glob("*.sql")):
        try:
            content = sql_file.read_text(encoding="utf-8", errors="ignore")
            rel_file = sql_file.relative_to(ROOT_DIR)

            # Tabelas
            for match in table_pattern.finditer(content):
                tbl = match.group(1)
                tbl_id = f"table:{tbl}"
                add_node(tbl_id, tbl, "DatabaseTable", rel_file)
                tables.append(tbl)

            # Views
            for match in view_pattern.finditer(content):
                vw = match.group(1)
                vw_id = f"view:{vw}"
                add_node(vw_id, vw, "DatabaseView", rel_file)
                views.append(vw)

            # Funções de Segurança RLS
            for match in func_pattern.finditer(content):
                fn = match.group(1)
                fn_id = f"security_fn:{fn}"
                add_node(fn_id, fn, "SecurityFunction", rel_file)

            # Políticas de Segurança RLS
            for match in policy_pattern.finditer(content):
                pol = match.group(1)
                pol_id = f"security_policy:{pol}"
                add_node(pol_id, pol, "SecurityPolicy", rel_file)
                policies.append(pol)

                # Tabelas protegidas pela política
                for t_match in rls_target_pattern.finditer(content):
                    prot_tbl = t_match.group(1)
                    add_edge(pol_id, f"table:{prot_tbl}", "protects")

            # Linhagem de Foreign Keys: divide por blocos de CREATE TABLE
            table_blocks = re.split(r"CREATE\s+TABLE\s+(?:dbo\.)?\[?(\w+)\]?", content, flags=re.IGNORECASE)
            if len(table_blocks) > 1:
                for i in range(1, len(table_blocks), 2):
                    source_table = table_blocks[i]
                    block_body = table_blocks[i+1] if i+1 < len(table_blocks) else ""
                    for ref_match in fk_pattern.finditer(block_body):
                        target_table = ref_match.group(1)
                        if target_table != source_table:
                            add_edge(f"table:{source_table}", f"table:{target_table}", "references")
                            foreign_keys.append((source_table, target_table))

        except Exception:
            continue

    return sorted(list(set(tables))), sorted(list(set(views))), sorted(list(set(policies))), foreign_keys

# ==============================================================================
# 2. MENSAGERIA ASSÍNCRONA & CACHE (RabbitMQ, DLX/DLQ, Redis Pub/Sub)
# ==============================================================================
def scan_messaging_and_cache():
    # Topologia Canônica RabbitMQ
    dlx_id = "exchange:ecommerce_dlx"
    dlq_id = "queue:dlq_ecommerce"
    add_node(dlx_id, "ecommerce_dlx", "DeadLetterExchange", "EcommerceBot.Worker/app/core/config/rabbitmq.py", {"type": "direct"})
    add_node(dlq_id, "dlq_ecommerce", "DeadLetterQueue", "EcommerceBot.Worker/app/core/config/rabbitmq.py", {"ttl": "7 days"})
    add_edge(dlx_id, dlq_id, "routes_dead_letter")

    queues = [
        ("queue:demo_ecommerce", "demo_ecommerce", "Scraping demo com prioridade e DLX ativa"),
        ("queue:ecommerce", "ecommerce", "Fila principal de extração de catálogo de lojistas"),
        ("queue:ecommerce_processed_queue", "ecommerce_processed_queue", "Retorno assíncrono de produtos processados para Dapper/SSE"),
        ("queue:analytics_ml_queue", "analytics_ml_queue", "Entrada de análise RFM, Churn e LTV no Worker"),
        ("queue:analytics_processed_queue", "analytics_processed_queue", "Retorno de scores de machine learning para a Core API"),
        ("queue:llm_usage_queue", "llm_usage_queue", "Auditoria assíncrona de consumo de tokens e custos de IA"),
        ("queue:payments_process_queue", "payments_process_queue", "Conciliação e liberação de créditos de recarga Mercado Pago"),
        ("queue:email_notifications", "email_notifications", "Fila de envio transacional de e-mails via Resend"),
        ("queue:shopify_bulk_sync", "shopify_bulk_sync", "Sincronização em lote de catálogo Shopify GraphQL"),
        ("queue:nuvemshop_bulk_sync", "nuvemshop_bulk_sync", "Sincronização em lote de catálogo Nuvemshop REST")
    ]

    for q_id, q_name, q_desc in queues:
        add_node(q_id, q_name, "MessageQueue", "EcommerceBot.Worker/app/core/config/rabbitmq.py", {"description": q_desc})
        if q_name in ["demo_ecommerce", "ecommerce", "analytics_ml_queue"]:
            add_edge(q_id, dlx_id, "routes_dead_letter")

    # Redis SafeCache & SSE Pub/Sub
    add_node("infrastructure:Redis", "Redis 7 Server", "InfrastructureComponent", metadata={"roles": ["Cache", "Idempotency", "SSE_PubSub"]})
    add_node("channel:events:tenant", "events:tenant:{tenantId}", "RedisPubSubChannel", metadata={"purpose": "Streaming SSE em tempo real"})
    add_edge("infrastructure:Redis", "channel:events:tenant", "hosts_channel")

    return [q[1] for q in queues]

# ==============================================================================
# 3. BACKEND TRANSACIONAL (.NET 9 Core API, Gateways, Consumers, Repos)
# ==============================================================================
def scan_dotnet_core():
    core_dir = ROOT_DIR / "EcommerceBot.Core"
    if not core_dir.exists():
        return [], [], [], []

    controllers = []
    consumers = []
    gateways = []
    services_and_repos = []

    route_pattern = re.compile(r'\[Route\(["\'](.*?)["\']\)\]', re.MULTILINE)
    http_attr_pattern = re.compile(r'\[Http(Get|Post|Put|Delete|Patch)(?:\(["\'](.*?)["\']\))?\]', re.MULTILINE)
    class_pattern = re.compile(r'public\s+(?:sealed\s+)?class\s+(\w+)', re.MULTILINE)
    consumer_pattern = re.compile(r'public\s+(?:sealed\s+)?class\s+(\w+)\s*:\s*IConsumer<(\w+)>', re.MULTILINE)
    dapper_table_pattern = re.compile(r'(?:FROM|INSERT\s+INTO|UPDATE|JOIN)\s+dbo\.(\w+)', re.IGNORECASE)
    injected_pattern = re.compile(r'\bI([A-Z]\w+(?:Service|Repository|Gateway))\b')

    # Mapeamento Canônico de Consumidores -> Filas
    consumer_queue_mapping = {
        "ProcessedProductConsumer": "queue:ecommerce_processed_queue",
        "LlmUsageConsumer": "queue:llm_usage_queue",
        "EmailNotificationConsumer": "queue:email_notifications",
        "NuvemshopBulkSyncConsumer": "queue:nuvemshop_bulk_sync",
        "ShopifyBulkSyncConsumer": "queue:shopify_bulk_sync",
        "AnalyticsProcessedConsumer": "queue:analytics_processed_queue",
        "PaymentProcessingConsumer": "queue:payments_process_queue"
    }

    # Mapeamento Canônico de Publicadores -> Filas
    producer_queue_mapping = {
        "ScraperService": ["queue:ecommerce", "queue:demo_ecommerce"],
        "MachineLearningService": ["queue:analytics_ml_queue"],
        "MercadoPagoWebhookService": ["queue:payments_process_queue"],
        "AuthService": ["queue:email_notifications"],
        "ShopifyIntegrationService": ["queue:shopify_bulk_sync"],
        "NuvemshopIntegrationService": ["queue:nuvemshop_bulk_sync"],
        "PaymentProcessingConsumer": ["queue:email_notifications"],
        "ProcessedProductConsumer": ["channel:events:tenant"]
    }

    # Gateways Externos
    external_api_mapping = {
        "ShopifyGateway": "external_api:ShopifyGraphQL",
        "NuvemshopGateway": "external_api:NuvemshopV1",
        "MercadoPagoGateway": "external_api:MercadoPagoAPI",
        "ResendGateway": "external_api:ResendAPI"
    }

    for cs_file in core_dir.rglob("*.cs"):
        if any(ignored in cs_file.parts for ignored in ["bin", "obj", ".vs", "EcommerceBot.Diagnostics.Mcp"]):
            continue
        try:
            content = cs_file.read_text(encoding="utf-8", errors="ignore")
            rel_path = cs_file.relative_to(ROOT_DIR)

            # Middlewares
            if "Middleware" in cs_file.name:
                c_match = class_pattern.search(content)
                if c_match:
                    mid_name = c_match.group(1)
                    mid_id = f"middleware:{mid_name}"
                    add_node(mid_id, mid_name, "ApiMiddleware", rel_path)

            # Controllers
            if "Controller" in cs_file.name:
                class_match = class_pattern.search(content)
                if class_match:
                    ctrl_name = class_match.group(1)
                    ctrl_id = f"controller:{ctrl_name}"
                    base_route = ""
                    r_match = route_pattern.search(content)
                    if r_match:
                        base_route = r_match.group(1)

                    endpoints = []
                    for h_match in http_attr_pattern.finditer(content):
                        verb = h_match.group(1).upper()
                        sub_route = h_match.group(2) or ""
                        full_ep = f"{verb} {base_route}/{sub_route}".replace("//", "/").rstrip("/")
                        endpoints.append(full_ep)

                    add_node(ctrl_id, ctrl_name, "ApiController", rel_path, {"base_route": base_route, "endpoints": endpoints})
                    controllers.append({"name": ctrl_name, "route": base_route, "endpoints": endpoints, "id": ctrl_id})

                    for inj in injected_pattern.finditer(content):
                        target_code = inj.group(1)
                        if target_code != ctrl_name:
                            target_id = f"code:{target_code}"
                            add_node(target_id, target_code, "CoreServiceOrRepo")
                            add_edge(ctrl_id, target_id, "invokes")

            # MassTransit Consumers
            for cons_match in consumer_pattern.finditer(content):
                cons_name = cons_match.group(1)
                msg_type = cons_match.group(2)
                cons_id = f"consumer:{cons_name}"
                add_node(cons_id, cons_name, "MassTransitConsumer", rel_path, {"message": msg_type})
                consumers.append({"name": cons_name, "message": msg_type, "id": cons_id})

                if cons_name in consumer_queue_mapping:
                    q_id = consumer_queue_mapping[cons_name]
                    add_edge(cons_id, q_id, "consumes_from")

                if cons_name in producer_queue_mapping:
                    for target_q in producer_queue_mapping[cons_name]:
                        add_edge(cons_id, target_q, "publishes_to")

                for inj in injected_pattern.finditer(content):
                    target_code = inj.group(1)
                    if target_code != cons_name:
                        target_id = f"code:{target_code}"
                        add_node(target_id, target_code, "CoreServiceOrRepo")
                        add_edge(cons_id, target_id, "invokes")

            # Gateways
            if "Gateway" in cs_file.stem:
                gw_id = f"gateway:{cs_file.stem}"
                add_node(gw_id, cs_file.stem, "ExternalGateway", rel_path)
                gateways.append(cs_file.stem)
                if cs_file.stem in external_api_mapping:
                    ext_id = external_api_mapping[cs_file.stem]
                    add_node(ext_id, ext_id.replace("external_api:", ""), "ExternalApi")
                    add_edge(gw_id, ext_id, "integrates_with")

            # Serviços e Repositórios
            if "Service" in cs_file.stem or "Repository" in cs_file.stem:
                node_type = "CoreRepository" if "Repository" in cs_file.stem else "CoreService"
                file_id = f"code:{cs_file.stem}"
                add_node(file_id, cs_file.stem, node_type, rel_path)
                services_and_repos.append(cs_file.stem)

                if cs_file.stem in producer_queue_mapping:
                    for target_q in producer_queue_mapping[cs_file.stem]:
                        add_edge(file_id, target_q, "publishes_to")

                for inj in injected_pattern.finditer(content):
                    target_code = inj.group(1)
                    if target_code != cs_file.stem:
                        add_node(f"code:{target_code}", target_code, "CoreServiceOrRepo")
                        add_edge(file_id, f"code:{target_code}", "invokes")

                # Queries Dapper para Tabelas
                for match in dapper_table_pattern.finditer(content):
                    tbl = match.group(1)
                    table_id = f"table:{tbl}"
                    add_node(table_id, tbl, "DatabaseTable")
                    rel = "writes_to" if any(w in match.group(0).upper() for w in ["INSERT", "UPDATE"]) else "queries"
                    add_edge(file_id, table_id, rel)

        except Exception:
            continue

    return controllers, consumers, gateways, services_and_repos

# ==============================================================================
# 4. PYTHON WORKER (FastAPI, Scraper, AI Router, ML/Spark, Jinja2)
# ==============================================================================
def scan_python_worker():
    worker_dir = ROOT_DIR / "EcommerceBot.Worker"
    if not worker_dir.exists():
        return [], []

    modules = []
    models = []

    # 1. FastAPI App
    main_py = worker_dir / "app" / "main.py"
    if main_py.exists():
        add_node("service:WorkerFastAPI", "EcommerceBot.Worker FastAPI", "FastAPIService", main_py.relative_to(ROOT_DIR), {
            "endpoints": ["GET /health", "GET /health/live", "GET /health/ready"]
        })

    # 2. Scraper Worker & Parsers
    scraper_dir = worker_dir / "app" / "scraper"
    if scraper_dir.exists():
        add_node("worker:ScraperWorker", "ScraperWorker", "PythonWorkerModule", (scraper_dir / "worker.py").relative_to(ROOT_DIR))
        add_edge("worker:ScraperWorker", "queue:ecommerce", "consumes_from")
        add_edge("worker:ScraperWorker", "queue:demo_ecommerce", "consumes_from")
        add_edge("worker:ScraperWorker", "queue:ecommerce_processed_queue", "publishes_to")
        add_edge("worker:ScraperWorker", "queue:llm_usage_queue", "publishes_to")
        add_edge("worker:ScraperWorker", "exchange:ecommerce_dlx", "routes_dead_letter")

        for p_file in ["parser.py", "scrapling_client.py", "json_ld_parser.py", "markdown_parser.py"]:
            if (scraper_dir / p_file).exists():
                p_id = f"scraper_component:{p_file.replace('.py', '')}"
                add_node(p_id, p_file, "ScraperComponent", (scraper_dir / p_file).relative_to(ROOT_DIR))
                add_edge("worker:ScraperWorker", p_id, "uses")

    # 3. LLM Engine Router & Providers
    ai_dir = worker_dir / "app" / "ai"
    if ai_dir.exists():
        router_id = "ai:LLMEngineRouter"
        add_node(router_id, "LLMEngineRouter", "AIRouter", (ai_dir / "router.py").relative_to(ROOT_DIR), {
            "features": ["PII Masking", "Anti-Prompt Injection", "OWASP LLM Guard"]
        })
        add_node("external_api:OpenRouterLLM", "OpenRouter AI API", "ExternalApi")
        add_edge(router_id, "external_api:OpenRouterLLM", "integrates_with")
        add_edge("scraper_component:parser", router_id, "invokes")

    # 4. Machine Learning & Spark Pipelines
    ml_dir = worker_dir / "app" / "ml"
    if ml_dir.exists():
        ml_worker_id = "worker:MLWorker"
        add_node(ml_worker_id, "MLWorker", "PythonWorkerModule", (ml_dir / "ml_worker.py").relative_to(ROOT_DIR))
        add_edge(ml_worker_id, "queue:analytics_ml_queue", "consumes_from")
        add_edge(ml_worker_id, "queue:analytics_processed_queue", "publishes_to")
        add_edge(ml_worker_id, "exchange:ecommerce_dlx", "routes_dead_letter")

        ml_classes = ["RFMSegmentation", "ChurnPredictor", "LTVForecaster", "TokenCapacityForecaster"]
        for cls_name in ml_classes:
            m_id = f"ml_model:{cls_name}"
            add_node(m_id, cls_name, "MachineLearningModel")
            add_edge(ml_worker_id, m_id, "executes")
            models.append(cls_name)

        # Spark Batch Pipeline
        spark_file = ml_dir / "spark" / "batch_pipeline.py"
        if spark_file.exists():
            add_node("ml_pipeline:SparkBatchPipeline", "SparkBatchPipeline", "SparkBatchPipeline", spark_file.relative_to(ROOT_DIR))
            add_node("artifact:rfm_pipeline.joblib", "rfm_pipeline.joblib", "MLArtifact")
            add_edge("ml_pipeline:SparkBatchPipeline", "artifact:rfm_pipeline.joblib", "exports")
            add_edge("artifact:rfm_pipeline.joblib", "ml_model:RFMSegmentation", "calibrates")

    # 5. Templates Jinja2
    templates_dir = worker_dir / "app" / "templates"
    if templates_dir.exists():
        for t_file in templates_dir.glob("*.*"):
            t_id = f"template:{t_file.name}"
            add_node(t_id, t_file.name, "Jinja2Template", t_file.relative_to(ROOT_DIR))

    return modules, models

# ==============================================================================
# 5. FRONTEND SPA (React 18, AppRoutes, Features, Services, Hooks, API Bindings)
# ==============================================================================
def scan_frontend_web(controllers):
    web_dir = ROOT_DIR / "EcommerceBot.Web" / "src"
    if not web_dir.exists():
        return [], [], []

    pages = []
    features = []
    services = []

    # 1. AppRoutes e Páginas Mapeadas
    routes_file = web_dir / "routes" / "AppRoutes.tsx"
    if routes_file.exists():
        try:
            content = routes_file.read_text(encoding="utf-8", errors="ignore")
            route_pattern = re.compile(r'<Route\s+path=["\'](.*?)["\']\s+element=\{<(\w+)', re.MULTILINE)
            for match in route_pattern.finditer(content):
                path = match.group(1)
                page_component = match.group(2)
                p_id = f"frontend_page:{page_component}"
                guard = "AdminRouteGuard" if "/admin" in path else ("MerchantRouteGuard" if path in ["/dashboard", "/integrations", "/analytics/traffic", "/metering"] else "PublicOrProtected")
                add_node(p_id, page_component, "FrontendPage", routes_file.relative_to(ROOT_DIR), {
                    "path": path,
                    "guard": guard
                })
                pages.append({"component": page_component, "path": path, "guard": guard})
        except Exception:
            pass

    # 2. Features React
    features_dir = web_dir / "features"
    if features_dir.exists():
        for item in features_dir.iterdir():
            if item.is_dir():
                feat_name = item.name
                feat_id = f"frontend_feature:{feat_name}"
                layers = [sub.name for sub in item.iterdir() if sub.is_dir()]
                add_node(feat_id, feat_name, "FrontendFeature", item.relative_to(ROOT_DIR), {"layers": layers})
                features.append(feat_name)

    # 3. Serviços e Conexão Semântica de Endpoints com Core API
    endpoint_call_pattern = re.compile(r'apiClient\.(?:get|post|put|delete|patch)[^(\'"`]*\([\'"`](/api/v1/[a-zA-Z0-9_\-/]+)', re.MULTILINE)
    sse_call_pattern = re.compile(r'new\s+EventSource\([\'"`](/api/v1/[a-zA-Z0-9_\-/]+)', re.MULTILINE)

    for svc_file in web_dir.rglob("*.ts"):
        if any(ignored in svc_file.parts for ignored in ["node_modules", "dist", ".test."]):
            continue
        is_service = "service" in svc_file.name.lower()
        is_hook = svc_file.name.startswith("use")

        if not (is_service or is_hook):
            continue

        try:
            content = svc_file.read_text(encoding="utf-8", errors="ignore")
            node_type = "FrontendService" if is_service else "FrontendHook"
            s_id = f"frontend_{'service' if is_service else 'hook'}:{svc_file.stem}"
            add_node(s_id, svc_file.stem, node_type, svc_file.relative_to(ROOT_DIR))
            services.append(svc_file.stem)

            # Rastreamento de chamadas a endpoints
            called_endpoints = set(endpoint_call_pattern.findall(content))
            for sse_path in sse_call_pattern.findall(content):
                called_endpoints.add(sse_path)

            # Extração adicional de paths literais /api/v1/...
            for raw_match in re.findall(r'[\'"`](/api/v1/[a-zA-Z0-9_\-]+(?:/[a-zA-Z0-9_\-]+)?)[\'"`]', content):
                called_endpoints.add(raw_match)

            for ep in called_endpoints:
                # Conecta ao Controller correspondente pela rota base
                clean_ep = ep.replace("/api/v1/", "").split("/")[0].lower()
                for ctrl in controllers:
                    ctrl_route = (ctrl["route"] or "").lower().replace("api/v1/", "").replace("api/", "")
                    if clean_ep and (clean_ep in ctrl_route or ctrl_route in clean_ep or clean_ep in ctrl["name"].lower()):
                        add_edge(s_id, ctrl["id"], "calls_endpoint")
                        break

            # SSE Hook específico
            if "liveDemo" in svc_file.stem or "Demo" in svc_file.stem:
                add_edge(s_id, "controller:DemoController", "calls_endpoint")
                add_edge(s_id, "channel:events:tenant", "subscribes_sse")

        except Exception:
            continue

    return pages, features, sorted(list(set(services)))

# ==============================================================================
# 6. OBSERVABILIDADE & SRE (Servidor MCP, Runbooks, Docker, Scripts)
# ==============================================================================
def scan_observability_and_infra():
    # MCP Server
    mcp_dir = ROOT_DIR / "EcommerceBot.Core" / "src" / "EcommerceBot.Diagnostics.Mcp"
    mcp_server_id = "service:EcommerceBot.Diagnostics.Mcp"
    mcp_tools = []

    if mcp_dir.exists():
        add_node(mcp_server_id, "EcommerceBot.Diagnostics.Mcp", "McpServer", mcp_dir.relative_to(ROOT_DIR), {
            "transport": "stdio",
            "protocol": "JSON-RPC 2.0"
        })

        tool_classes = [
            ("check_sql_health", "CheckSqlHealthTool", "infrastructure:SqlServer", "inspects_dmvs"),
            ("check_redis_metrics", "CheckRedisMetricsTool", "infrastructure:Redis", "inspects_metrics"),
            ("inspect_rabbitmq_queues", "InspectRabbitMqQueuesTool", "exchange:ecommerce_dlx", "inspects_queues"),
            ("get_recent_application_errors", "GetRecentApplicationErrorsTool", "infrastructure:Serilog", "inspects_logs"),
            ("inspect_ml_artifacts", "InspectMlArtifactsTool", "artifact:rfm_pipeline.joblib", "inspects_artifacts"),
            ("check_spark_pipeline_status", "CheckSparkPipelineStatusTool", "ml_pipeline:SparkBatchPipeline", "inspects_pipeline")
        ]

        for t_name, t_cls, target_infra, rel in tool_classes:
            t_id = f"mcp_tool:{t_name}"
            add_node(t_id, t_name, "McpDiagnosticTool", metadata={"className": t_cls})
            add_edge(mcp_server_id, t_id, "registers_tool")
            add_edge(t_id, target_infra, rel)
            mcp_tools.append({"name": t_name, "class": t_cls})

    add_node("infrastructure:SqlServer", "SQL Server 2022", "InfrastructureComponent")
    add_node("infrastructure:Serilog", "Serilog Rolling Logs", "InfrastructureComponent")

    # Runbooks
    runbooks = []
    runbooks_dir = ROOT_DIR / "docs" / "runbooks"
    if runbooks_dir.exists():
        title_pattern = re.compile(r"^#\s+(.+)$", re.MULTILINE)
        for md_file in sorted(runbooks_dir.glob("*.md")):
            try:
                content = md_file.read_text(encoding="utf-8", errors="ignore")
                match = title_pattern.search(content)
                title = match.group(1).strip() if match else md_file.stem
                rb_id = f"runbook:{md_file.stem}"
                add_node(rb_id, title, "KnowledgeRunbook", md_file.relative_to(ROOT_DIR), {
                    "uri": f"resource://runbooks/{md_file.stem}"
                })
                add_edge(mcp_server_id, rb_id, "exposes_resource")
                runbooks.append({"slug": md_file.stem, "title": title})
            except Exception:
                continue

    # Infraestrutura & SRE
    infra_containers = ["mssql", "redis", "rabbitmq", "api", "worker", "web", "nginx"]
    for c in infra_containers:
        c_id = f"container:{c}"
        add_node(c_id, f"prod-{c}", "DockerContainer", "infra/prod/docker-compose.prod.yml")

    sre_scripts = [
        ("backup_sqlserver_r2.sh", "Backup diário full para Cloudflare R2 com DBCC prévio"),
        ("backup_sqlserver_log_r2.sh", "Backup de transaction log a cada 15 min (RPO < 15 min)"),
        ("provision_vps_host.sh", "Provisionamento de host Ubuntu, kernel sysctl e UFW"),
        ("setup_sqlserver_maintenance.sh", "Índices e estatísticas via Ola Hallengren")
    ]
    for s_name, s_desc in sre_scripts:
        s_id = f"sre_script:{s_name.replace('.sh', '')}"
        add_node(s_id, s_name, "SreAutomationScript", f"infra/prod/scripts/{s_name}", {"purpose": s_desc})
        add_edge(s_id, "container:mssql", "operates_on")

    return mcp_tools, runbooks

# ==============================================================================
# 7. GERADOR DO RELATÓRIO EXECUTIVO TOKEN-DENSE (GRAPH_REPORT.md)
# ==============================================================================
def generate_report(tables, views, policies, controllers, consumers, queues, pages, features, services, mcp_tools, ml_models, runbooks):
    report_path = OUTPUT_DIR / "GRAPH_REPORT.md"

    lines = [
        "# 🗺️ E-commerce Bot — Topologia do Ecossistema (Knowledge Graph Summary)",
        "",
        "> **Fonte Canônica Determinística:** Consulte este sumário executivo antes de planejar refatorações. Detalhes exaustivos de nós e arestas residem em `.agents/graph.json`.",
        "",
        "## 🏛️ 1. Pilares da Arquitetura & Stack Tecnológica",
        "- **Frontend SPA (`EcommerceBot.Web`):** React 18 + Vite + Tailwind CSS em arquitetura orientada a features em 4 camadas (`Types -> Services -> Hooks -> Components`).",
        "- **Backend Core (`EcommerceBot.Core`):** ASP.NET Core (.NET 9), Clean Architecture / DDD, Dapper + SQL Server 2022, MassTransit Raw JSON.",
        "- **AI/ML Engine (`EcommerceBot.Worker`):** Python 3.13 (FastAPI + aio-pika + Scrapling + OpenRouter + Scikit-Learn + PySpark), 100% isolado de banco relacional.",
        "- **Database (`Database.Migrations`):** SQL Server 2022 com DbUp determinístico, RCSI ativo, Row-Level Security (RLS) e backups contínuos R2.",
        "- **Observabilidade & SRE (`EcommerceBot.Diagnostics.Mcp` & `infra/`):** Servidor MCP via `stdio` (JSON-RPC 2.0), Docker Compose e automações Linux.",
        "",
        "## 🔄 2. Matriz de Fluxos Críticos de Ponta a Ponta",
        "| Fluxo de Negócio | Ponto de Início (Frontend/Hook) | Ponto de Entrada (Core API) | Mensageria (RabbitMQ / Redis) | Processamento (Worker / Consumer) | Persistência / Saída |",
        "|---|---|---|---|---|---|",
        "| **Scraping Demo (Live)** | `LiveDemoPage` / `useLiveDemoSSE` | `POST /api/v1/demo/extract` | `queue:demo_ecommerce` (DLX) | `ScraperWorker` + OpenRouter | `events:tenant:{id}` (SSE) |",
        "| **Catálogo Multi-Tenant** | `CatalogPage` / `product.service` | `POST /api/v1/products/enrich` | `queue:ecommerce` | `ScraperWorker` + Scrapling | `dbo.Products` via Dapper |",
        "| **Recarga / Ledger** | `WalletPage` / `wallet.service` | `POST /api/v1/wallet/recharge` | `queue:payments_process_queue` | `PaymentProcessingConsumer` | `dbo.CreditTransactions` |",
        "| **Sync Nuvemshop** | `IntegrationsPage` / `integration.service` | `POST /api/v1/nuvemshop/sync` | `queue:nuvemshop_bulk_sync` | `NuvemshopBulkSyncConsumer` | `dbo.StoreIntegrations` |",
        "| **Sync Shopify** | `IntegrationsPage` / `integration.service` | `POST /api/v1/shopify/sync` | `queue:shopify_bulk_sync` | `ShopifyBulkSyncConsumer` | `dbo.StoreIntegrations` |",
        "| **Analytics ML / Churn** | `TrafficAnalyticsPage` / `mlAnalytics.service`| `POST /api/v1/analytics/train` | `queue:analytics_ml_queue` | `MLWorker` (RFM / Churn / LTV) | `queue:analytics_processed` |",
        "",
        "## 📡 3. Topologia de Mensageria EDA & Dead-Letter (RabbitMQ)",
        "- **Dead-Letter Exchange (DLX):** `ecommerce_dlx` (Direct)",
        "- **Dead-Letter Queue (DLQ):** `dlq_ecommerce` (TTL 7 dias)",
        "- **Filas com Proteção DLX Ativa:** `demo_ecommerce` (Max-Priority 10, Max-Length 100), `ecommerce`, `analytics_ml_queue`.",
        "- **Filas de Retorno & Operacionais:** `ecommerce_processed_queue`, `analytics_processed_queue`, `llm_usage_queue`, `payments_process_queue`, `email_notifications`, `shopify_bulk_sync`, `nuvemshop_bulk_sync`.",
        "- **Barramento Real-Time:** Redis Pub/Sub com canal parametrizado `events:tenant:{tenantId}` consumido pelo cliente SSE.",
        "",
        "## 🗄️ 4. Banco de Dados, Linhagem & Governança (SQL Server 2022)",
        f"- **Tabelas Monitoradas ({len(tables)}):** {', '.join(tables[:14])}...",
        f"- **Views Diagnósticas ({len(views)}):** {', '.join(views)}.",
        f"- **Políticas RLS Ativas ({len(policies)}):** `TenantSecurityPolicy` protegendo isolamento por `SESSION_CONTEXT(TenantId)` com predicado `Security.fn_TenantAccessPredicate`.",
        "- **Governança de Transações:** RCSI ativo (`READ_COMMITTED_SNAPSHOT ON`), Chaves Primárias `NEWSEQUENTIALID()`, clustered por `(TenantId, ...)`.",
        "",
        "## ⚡ 5. Controllers da API Core & Gateways Externos",
        f"- **Controllers Mapeados ({len(controllers)}):**"
    ]

    for ctrl in controllers[:10]:
        r = ctrl['route'] or '/'
        lines.append(f"  - **`{ctrl['name']}`** (`/{r}`): {len(ctrl['endpoints'])} endpoints.")

    if len(controllers) > 10:
        lines.append(f"  - *... e mais {len(controllers) - 10} controllers catalogados no graph.json.*")

    lines.extend([
        "- **Gateways Externos Integrados:** `ShopifyGateway` (GraphQL 2024+), `NuvemshopGateway` (REST V1), `MercadoPagoGateway` (PIX/CC), `ResendGateway` (E-mails).",
        "",
        "## 🔬 6. Engine de Inteligência Artificial & Machine Learning (Python Worker)",
        "- **FastAPI Worker Service:** Endpoints `/health`, `/health/live` e `/health/ready` com sondagem ativa de RabbitMQ e Redis.",
        "- **Scraper & Enriquecimento:** `ScraperWorker`, `ScraperAndLLMParser`, `ScraplingClient` com proteção Anti-SSRF e atalho nativo Shopify `.json`.",
        "- **Roteador LLM:** `LLMEngineRouter` (OpenRouter API) com mascaramento de PII e blindagem anti-injeção (OWASP LLM01/02).",
        f"- **Modelos Preditivos:** {', '.join(ml_models)} calibrados via `SparkBatchPipeline` (`rfm_pipeline.joblib`).",
        "",
        "## 🎨 7. Frontend SPA (`EcommerceBot.Web`)",
        f"- **Páginas & Rotas ({len(pages)}):** Auth, ResetPassword, LiveDemo, Catalog, Dashboard, Wallet, Integrations, Metering, TrafficAnalytics, AdminLeads, AdminAiCapacity, AdminGrowth, AdminPlans.",
        f"- **Features ({len(features)}):** {', '.join(features)}.",
        f"- **Serviços & Hooks HTTP ({len(services)}):** Conectados deterministicamente aos Controllers do backend via `calls_endpoint`.",
        "",
        "## 🛠️ 8. Servidor MCP de Diagnóstico & Infraestrutura SRE",
        "- **Servidor MCP:** `EcommerceBot.Diagnostics.Mcp` (`stdio`, JSON-RPC 2.0).",
        "- **Ferramentas Registradas:**"
    ])

    for tool in mcp_tools:
        lines.append(f"  - **`{tool['name']}`** (`{tool['class']}`)")

    lines.extend([
        f"- **Runbooks Catalogados ({len(runbooks)}):** Expostos via `resource://runbooks/{{slug}}`.",
        "- **Containers Docker:** `mssql`, `redis`, `rabbitmq`, `api`, `worker`, `web`, `nginx`.",
        "- **Automações SRE:** Backup Full diário R2 com `DBCC CHECKDB`, log truncation a cada 15 min, manutenção Ola Hallengren.",
        "",
        "## 🧭 9. Regras de Navegação para Agentes de IA",
        "1. **Zero Busca Cega:** Inspecione sempre `.agents/graph.json` para mapear dependências antes de alterar qualquer assinatura de método ou fila.",
        "2. **Contratos EDA:** Qualquer alteração em mensagens requer validação conjunta nos produtores C# e consumidores Python.",
        "3. **Multi-Tenancy:** Consultas SQL devem conter estritamente `WHERE TenantId = @TenantId` tipado.",
        "4. **Limites Frontend:** Nenhum arquivo React pode ultrapassar 350 linhas de código (Quality Gate ESLint)."
    ])

    report_path.write_text("\n".join(lines), encoding="utf-8")

# ==============================================================================
# MAIN ENTRYPOINT
# ==============================================================================
def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print("🔍 Escaneando topologia ampliada de ponta a ponta do monorepo...")

    tables, views, policies, foreign_keys = scan_sql_migrations()
    queues = scan_messaging_and_cache()
    controllers, consumers, gateways, services_and_repos = scan_dotnet_core()
    worker_modules, ml_models = scan_python_worker()
    pages, features, frontend_services = scan_frontend_web(controllers)
    mcp_tools, runbooks = scan_observability_and_infra()

    graph_data = {
        "metadata": {
            "version": "3.0",
            "generator": "generate_knowledge_graph.py",
            "scope": "End-to-End Monorepo (Frontend, Core API, EDA, Worker, Database, Infra)",
            "total_nodes": len(nodes),
            "total_edges": len(edges)
        },
        "nodes": nodes,
        "edges": edges
    }

    graph_path = OUTPUT_DIR / "graph.json"
    graph_path.write_text(json.dumps(graph_data, indent=2, ensure_ascii=False), encoding="utf-8")

    generate_report(
        tables=tables,
        views=views,
        policies=policies,
        controllers=controllers,
        consumers=consumers,
        queues=queues,
        pages=pages,
        features=features,
        services=frontend_services,
        mcp_tools=mcp_tools,
        ml_models=ml_models,
        runbooks=runbooks
    )

    print(f"✅ Topologia gerada com sucesso:")
    print(f"   - {graph_path} ({len(nodes)} nós, {len(edges)} arestas)")
    print(f"   - {OUTPUT_DIR / 'GRAPH_REPORT.md'} ({len((OUTPUT_DIR / 'GRAPH_REPORT.md').read_text(encoding='utf-8').splitlines())} linhas)")

if __name__ == "__main__":
    main()
