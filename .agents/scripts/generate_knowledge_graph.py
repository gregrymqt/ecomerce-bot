#!/usr/bin/env python3
"""
Extrator de Topologia e Grafo de Conhecimento do Ecossistema E-commerce Bot.
Analisa padrões estruturais em .NET, Python, SQL, React, MCP e Runbooks.
Gera:
  - .agents/graph.json: Mapeamento completo de nós e arestas de dependência.
  - .agents/GRAPH_REPORT.md: Sumário executivo denso (< 250 linhas) para agentes de IA.
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
    if not any(n["id"] == node_id for n in nodes):
        nodes.append({
            "id": node_id,
            "label": label,
            "type": node_type,
            "file": str(file_path).replace("\\", "/"),
            "metadata": metadata or {}
        })

def add_edge(source: str, target: str, relationship: str):
    edge = {"source": source, "target": target, "relationship": relationship}
    if edge not in edges:
        edges.append(edge)

def scan_sql_migrations():
    migrations_dir = ROOT_DIR / "Database.Migrations" / "Scripts"
    if not migrations_dir.exists():
        return []
    
    tables = []
    table_pattern = re.compile(r"CREATE\s+TABLE\s+(?:dbo\.)?\[?(\w+)\]?", re.IGNORECASE)
    
    for sql_file in sorted(migrations_dir.glob("*.sql")):
        try:
            content = sql_file.read_text(encoding="utf-8", errors="ignore")
            for match in table_pattern.finditer(content):
                tbl = match.group(1)
                table_id = f"table:{tbl}"
                add_node(table_id, tbl, "DatabaseTable", sql_file.relative_to(ROOT_DIR))
                tables.append(tbl)
        except Exception:
            continue
    return tables

def scan_dotnet_core():
    core_dir = ROOT_DIR / "EcommerceBot.Core"
    if not core_dir.exists():
        return [], []

    controllers = []
    consumers = []
    
    route_pattern = re.compile(r'\[Route\(["\'](.*?)["\']\)\]', re.MULTILINE)
    http_attr_pattern = re.compile(r'\[Http(Get|Post|Put|Delete|Patch)(?:\(["\'](.*?)["\']\))?\]', re.MULTILINE)
    class_pattern = re.compile(r'public\s+class\s+(\w+)', re.MULTILINE)
    consumer_pattern = re.compile(r'public\s+class\s+(\w+)\s*:\s*IConsumer<(\w+)>', re.MULTILINE)
    dapper_table_pattern = re.compile(r'FROM\s+dbo\.(\w+)|INSERT\s+INTO\s+dbo\.(\w+)|UPDATE\s+dbo\.(\w+)', re.IGNORECASE)

    for cs_file in core_dir.rglob("*.cs"):
        if any(ignored in cs_file.parts for ignored in ["bin", "obj", ".vs", "EcommerceBot.Diagnostics.Mcp"]):
            continue
        try:
            content = cs_file.read_text(encoding="utf-8", errors="ignore")
            rel_path = cs_file.relative_to(ROOT_DIR)

            # Detectar Controllers
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
                        endpoints.append(f"{verb} {base_route}/{sub_route}".replace("//", "/").strip("/"))

                    add_node(ctrl_id, ctrl_name, "ApiController", rel_path, {"base_route": base_route, "endpoints": endpoints})
                    controllers.append({"name": ctrl_name, "route": base_route, "endpoints": endpoints})

            # Detectar Consumers MassTransit
            for cons_match in consumer_pattern.finditer(content):
                cons_name = cons_match.group(1)
                msg_type = cons_match.group(2)
                cons_id = f"consumer:{cons_name}"
                add_node(cons_id, cons_name, "MassTransitConsumer", rel_path, {"message": msg_type})
                consumers.append({"name": cons_name, "message": msg_type})

            # Detectar queries Dapper para tabelas
            for match in dapper_table_pattern.finditer(content):
                tbl = next(g for g in match.groups() if g is not None)
                table_id = f"table:{tbl}"
                file_id = f"code:{cs_file.stem}"
                add_node(file_id, cs_file.stem, "CoreServiceOrRepo", rel_path)
                add_edge(file_id, table_id, "queries")

        except Exception:
            continue

    return controllers, consumers

def scan_mcp_diagnostics():
    mcp_dir = ROOT_DIR / "EcommerceBot.Core" / "src" / "EcommerceBot.Diagnostics.Mcp"
    if not mcp_dir.exists():
        return []

    add_node("infrastructure:SqlServer", "SQL Server 2022", "InfrastructureComponent")
    add_node("infrastructure:Redis", "Redis 7 Cache", "InfrastructureComponent")
    add_node("infrastructure:RabbitMQ", "RabbitMQ 3.13 Broker", "InfrastructureComponent")
    add_node("infrastructure:Serilog", "Serilog Rolling JSON Logs", "InfrastructureComponent")

    mcp_server_id = "service:EcommerceBot.Diagnostics.Mcp"
    add_node(mcp_server_id, "EcommerceBot.Diagnostics.Mcp", "McpServer", mcp_dir.relative_to(ROOT_DIR), {
        "transport": "stdio",
        "protocol": "JSON-RPC 2.0",
        "capabilities": ["tools", "resources"]
    })

    tools = []
    tool_interface_pattern = re.compile(r'public\s+class\s+(\w+)\s*:\s*ISystemDiagnosticTool', re.MULTILINE)
    tool_name_pattern = re.compile(r'public\s+string\s+Name\s*=>\s*["\'](\w+)["\']', re.MULTILINE)
    tool_desc_pattern = re.compile(r'public\s+string\s+Description\s*=>\s*["\'](.*?)["\']', re.MULTILINE)

    for cs_file in mcp_dir.rglob("*.cs"):
        if any(ignored in cs_file.parts for ignored in ["bin", "obj", ".vs"]):
            continue
        try:
            content = cs_file.read_text(encoding="utf-8", errors="ignore")
            rel_path = cs_file.relative_to(ROOT_DIR)

            if "ISystemDiagnosticTool" in content and "public interface" not in content:
                class_match = tool_interface_pattern.search(content)
                if not class_match:
                    continue

                name_match = tool_name_pattern.search(content)
                desc_match = tool_desc_pattern.search(content)

                class_name = class_match.group(1)
                tool_name = name_match.group(1) if name_match else cs_file.stem
                tool_desc = desc_match.group(1) if desc_match else ""

                tool_id = f"mcp_tool:{tool_name}"
                add_node(tool_id, tool_name, "McpDiagnosticTool", rel_path, {
                    "className": class_name,
                    "description": tool_desc
                })
                add_edge(mcp_server_id, tool_id, "registers_tool")

                if "sql" in tool_name.lower():
                    add_edge(tool_id, "infrastructure:SqlServer", "inspects_dmvs")
                elif "redis" in tool_name.lower():
                    add_edge(tool_id, "infrastructure:Redis", "inspects_metrics")
                elif "rabbitmq" in tool_name.lower():
                    add_edge(tool_id, "infrastructure:RabbitMQ", "inspects_queues")
                elif "error" in tool_name.lower():
                    add_edge(tool_id, "infrastructure:Serilog", "inspects_logs")

                tools.append({"name": tool_name, "class": class_name, "description": tool_desc})
        except Exception:
            continue

    return tools

def scan_ml_engine():
    ml_dir = ROOT_DIR / "EcommerceBot.Worker" / "app" / "ml"
    if not ml_dir.exists():
        return []

    models = []
    class_pattern = re.compile(r'class\s+([A-Z]\w+)\s*:', re.MULTILINE)

    for py_file in ml_dir.rglob("*.py"):
        if any(ignored in py_file.parts for ignored in [".venv", "__pycache__", "build", "dist"]):
            continue
        try:
            content = py_file.read_text(encoding="utf-8", errors="ignore")
            rel_path = py_file.relative_to(ROOT_DIR)

            for match in class_pattern.finditer(content):
                cls_name = match.group(1)
                if cls_name in ["AnalyticsMLEngine", "RFMSegmentation", "ChurnPredictor", "LTVForecaster", "TokenCapacityForecaster", "SparkBatchPipeline"]:
                    node_type = "SparkBatchPipeline" if "Spark" in cls_name else "MachineLearningModel"
                    model_id = f"ml_model:{cls_name}"
                    add_node(model_id, cls_name, node_type, rel_path)

                    if "Spark" in cls_name:
                        artifact_id = "artifact:rfm_pipeline.joblib"
                        add_node(artifact_id, "rfm_pipeline.joblib", "MLArtifact")
                        add_edge(model_id, artifact_id, "exports")
                        add_edge(artifact_id, "ml_model:RFMSegmentation", "calibrates")
                    else:
                        add_edge("worker:ml_worker", model_id, "executes")

                    models.append({"name": cls_name, "type": node_type, "file": str(rel_path)})
        except Exception:
            continue

    return models

def scan_runbooks():
    runbooks_dir = ROOT_DIR / "docs" / "runbooks"
    if not runbooks_dir.exists():
        return []

    runbooks = []
    title_pattern = re.compile(r"^#\s+(.+)$", re.MULTILINE)

    for md_file in sorted(runbooks_dir.glob("*.md")):
        try:
            content = md_file.read_text(encoding="utf-8", errors="ignore")
            rel_path = md_file.relative_to(ROOT_DIR)
            match = title_pattern.search(content)
            title = match.group(1).strip() if match else md_file.stem

            rb_id = f"runbook:{md_file.stem}"
            add_node(rb_id, title, "KnowledgeRunbook", rel_path, {
                "uri": f"resource://runbooks/{md_file.stem}"
            })
            add_edge("service:EcommerceBot.Diagnostics.Mcp", rb_id, "exposes_resource")
            runbooks.append({"slug": md_file.stem, "title": title})
        except Exception:
            continue

    return runbooks

def scan_python_worker():
    worker_dir = ROOT_DIR / "EcommerceBot.Worker"
    if not worker_dir.exists():
        return []

    queues = ["queue:ecommerce", "ecommerce_processed_queue", "email_notifications", "nuvemshop_bulk_sync"]
    queue_pattern = re.compile(r'["\'](queue:[a-zA-Z0-9_\-]+|[a-zA-Z0-9_\-]+_queue|email_notifications|nuvemshop_bulk_sync)["\']')
    
    found_queues = set()
    for py_file in worker_dir.rglob("*.py"):
        if any(ignored in py_file.parts for ignored in [".venv", "__pycache__", "build", "dist"]):
            continue
        try:
            content = py_file.read_text(encoding="utf-8", errors="ignore")
            rel_path = py_file.relative_to(ROOT_DIR)
            
            for match in queue_pattern.finditer(content):
                q = match.group(1)
                found_queues.add(q)
                q_id = f"queue:{q}"
                worker_node_id = f"worker:{py_file.stem}"
                add_node(q_id, q, "MessageQueue")
                add_node(worker_node_id, py_file.stem, "PythonWorkerModule", rel_path)
                add_edge(worker_node_id, q_id, "interacts_with")
        except Exception:
            continue

    for q in queues:
        found_queues.add(q)
        add_node(f"queue:{q}", q, "MessageQueue")

    return sorted(list(found_queues))

def scan_react_features():
    web_features_dir = ROOT_DIR / "EcommerceBot.Web" / "src" / "features"
    if not web_features_dir.exists():
        return []

    features = []
    for item in web_features_dir.iterdir():
        if item.is_dir():
            feat_name = item.name
            feat_id = f"frontend_feature:{feat_name}"
            layers = [sub.name for sub in item.iterdir() if sub.is_dir()]
            add_node(feat_id, feat_name, "FrontendFeature", item.relative_to(ROOT_DIR), {"layers": layers})
            features.append({"name": feat_name, "layers": layers})
    return features

def generate_report(tables, controllers, consumers, queues, features, mcp_tools, ml_models, runbooks):
    report_path = OUTPUT_DIR / "GRAPH_REPORT.md"
    
    lines = [
        "# 🗺️ E-commerce Bot — Topologia do Ecossistema (Knowledge Graph Summary)",
        "",
        "> **Fonte Determinística de Navegação:** Consulte este sumário ou `.agents/graph.json` antes de planejar refatorações.",
        "",
        "## 🏛️ 1. Pilares e Módulos Centrais",
        "- **Backend Core:** ASP.NET Core (.NET 8/9), Dapper, SQL Server 2022, MassTransit.",
        "- **MCP Diagnostics:** C# .NET 9 Console (`EcommerceBot.Diagnostics.Mcp`) via `stdio` (JSON-RPC 2.0).",
        "- **AI & ML Engine:** Python 3.13 (FastAPI + aio-pika + Scrapling + Scikit-Learn + PySpark), 100% isolado de banco.",
        "- **Frontend:** React 18 + Vite + Tailwind CSS em arquitetura orientada a features.",
        "- **Database:** SQL Server 2022 com migrações versionadas via DbUp.",
        "",
        "## 📡 2. Topologia de Filas RabbitMQ & Interoperabilidade",
    ]

    for q in queues:
        lines.append(f"- `Fila:` **`{q}`**")

    lines.extend([
        "",
        "## 🗄️ 3. Tabelas Mapeadas no Banco de Dados (DbUp)",
        f"- **Total de Tabelas Detectadas:** {len(tables)}",
        f"- **Tabelas Core:** {', '.join(tables[:12]) if tables else 'Nenhuma'}{'...' if len(tables) > 12 else ''}",
        "",
        "## ⚡ 4. Controllers e Rotas da API Core",
    ])

    for ctrl in controllers[:10]:
        route = ctrl['route'] or '/'
        lines.append(f"- **{ctrl['name']}** (`/{route}`): {len(ctrl['endpoints'])} endpoints mapeados.")

    if len(controllers) > 10:
        lines.append(f"- *... e mais {len(controllers) - 10} controllers catalogados no graph.json.*")

    lines.extend([
        "",
        "## 🎨 5. Módulos Frontend (`EcommerceBot.Web`)",
    ])

    for feat in features:
        layers_str = ", ".join(feat["layers"]) if feat["layers"] else "Standard"
        lines.append(f"- **{feat['name']}**: [{layers_str}]")

    lines.extend([
        "",
        "## 🛠️ 6. Servidor MCP de Diagnóstico (`EcommerceBot.Diagnostics.Mcp`)",
        "- **Transporte:** `stdio` (JSON-RPC 2.0 padrão v2024-11-05)",
        "- **Ferramentas Registradas:**"
    ])

    for tool in mcp_tools:
        lines.append(f"  - **`{tool['name']}`** (`{tool['class']}`): {tool['description']}")

    lines.extend([
        "",
        "## 🔬 7. Modelos de Machine Learning & Spark (`EcommerceBot.Worker/app/ml`)",
    ])

    for model in ml_models:
        lines.append(f"- **`{model['name']}`** ({model['type']})")

    lines.extend([
        "",
        "## 📚 8. Runbooks Operacionais Catalogados (`docs/runbooks`)",
    ])

    for rb in runbooks:
        lines.append(f"- **`resource://runbooks/{rb['slug']}`**: {rb['title']}")

    lines.extend([
        "",
        "## 🧭 9. Diretriz de Uso para Agentes",
        "1. Para verificar o raio de impacto de um campo ou contrato, localize o símbolo no `.agents/graph.json`.",
        "2. NUNCA altere assinaturas de mensageria sem verificar consumidores em C# e handlers Python simultaneamente.",
        "3. Mantenha queries em conformidade com as tabelas listadas na Seção 3 e isole queries por `TenantId`.",
        "4. Utilize as ferramentas do Servidor MCP (Seção 6) para inspeção operacional antes de qualquer alteração de infraestrutura."
    ])

    report_path.write_text("\n".join(lines), encoding="utf-8")

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print("🔍 Escaneando topologia ampliada do monorepo...")
    
    tables = scan_sql_migrations()
    controllers, consumers = scan_dotnet_core()
    queues = scan_python_worker()
    features = scan_react_features()
    mcp_tools = scan_mcp_diagnostics()
    ml_models = scan_ml_engine()
    runbooks = scan_runbooks()

    graph_data = {
        "metadata": {
            "version": "2.0",
            "generator": "generate_knowledge_graph.py",
            "total_nodes": len(nodes),
            "total_edges": len(edges)
        },
        "nodes": nodes,
        "edges": edges
    }

    graph_path = OUTPUT_DIR / "graph.json"
    graph_path.write_text(json.dumps(graph_data, indent=2, ensure_ascii=False), encoding="utf-8")
    
    generate_report(tables, controllers, consumers, queues, features, mcp_tools, ml_models, runbooks)

    print(f"✅ Topologia gerada com sucesso:")
    print(f"   - {graph_path} ({len(nodes)} nós, {len(edges)} arestas)")
    print(f"   - {OUTPUT_DIR / 'GRAPH_REPORT.md'}")

if __name__ == "__main__":
    main()
