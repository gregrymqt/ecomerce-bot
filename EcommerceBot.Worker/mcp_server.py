import os
import sys
from pathlib import Path
from typing import Optional, Dict, Any
from mcp.server.fastmcp import FastMCP

# Assegura que o diretório raiz do Worker esteja no sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.core.shared.security import validate_url_safety
from app.scraper.parser import ScraperParser

# Inicializa o servidor FastMCP via STDIO
mcp = FastMCP("EcommerceBot-Scraper-Worker")

LOGS_DIR = BASE_DIR / "logs"


@mcp.tool()
async def test_scrape_url(url: str) -> Dict[str, Any]:
    """
    Executa um scraping isolado (dry-run) de uma URL de e-commerce fornecida.
    Extrai título, categoria, marca, preço, lista de imagens e prévia de Markdown limpo.
    Operação 100% Read-Only: zero publicações no RabbitMQ, zero escrita no Redis e zero banco de dados.
    """
    # 1. Defesa em Profundidade Anti-SSRF (bloqueio de loopback, RFC 1918 e metadados)
    try:
        validate_url_safety(url)
    except ValueError as ssrf_err:
        return {
            "status": "BLOCKED",
            "url": url,
            "security_policy": "Anti-SSRF Fail-Closed",
            "reason": str(ssrf_err)
        }

    # 2. Execução isolada do motor Scrapling / JSON-LD / HTML2Text
    try:
        parser = ScraperParser()
        result = await parser.parse_and_enrich(url)

        raw_md = result.get("raw_markdown") or result.get("description") or ""
        raw_images = result.get("images") or []

        return {
            "status": "SUCCESS",
            "url": url,
            "title": result.get("title") or result.get("raw_title"),
            "category": result.get("category"),
            "brand": result.get("brand"),
            "price": result.get("price"),
            "currency": result.get("currency", "BRL"),
            "images_count": len(raw_images),
            "markdown_preview": (raw_md[:500] + "...") if len(raw_md) > 500 else raw_md,
            "markdown_length": len(raw_md),
            "has_raw_html": bool(result.get("raw_description_html")),
            "protection_tier_used": result.get("model_used", "scrapling/adaptive-dom")
        }
    except Exception as exc:
        return {
            "status": "ERROR",
            "url": url,
            "error_type": type(exc).__name__,
            "message": str(exc)
        }


# Impede que o test runner do pytest trate a ferramenta MCP como um teste de unidade
test_scrape_url.__test__ = False


@mcp.tool()
def read_scraper_logs(lines: int = 80, filter_query: Optional[str] = None) -> str:
    """
    Lê as últimas linhas do arquivo de log do worker de scraping persistido em disco.
    Permite filtrar por termos específicos como '403', 'Cloudflare', 'timeout' ou um SKU/URL.
    """
    if not LOGS_DIR.exists():
        return f"Diretório de logs não encontrado em: {LOGS_DIR}"

    log_files = list(LOGS_DIR.glob("*.log"))
    if not log_files:
        return f"Nenhum arquivo de log (.log) encontrado na pasta {LOGS_DIR}"

    # Seleciona o arquivo modificado mais recentemente
    latest_log = max(log_files, key=os.path.getmtime)

    try:
        with open(latest_log, "r", encoding="utf-8", errors="replace") as f:
            all_lines = f.readlines()

        if filter_query:
            query = filter_query.lower()
            filtered = [line for line in all_lines if query in line.lower()]
            selected_lines = filtered[-lines:]
        else:
            selected_lines = all_lines[-lines:]

        header = (
            f"--- [Lendo {latest_log.name}] Últimas {len(selected_lines)} linhas "
            f"(Filtro: '{filter_query or 'Nenhum'}') ---\n"
        )
        return header + "".join(selected_lines)

    except Exception as exc:
        return f"Falha ao ler arquivo de log ({latest_log.name}): {str(exc)}"


@mcp.tool()
def check_scraper_health() -> Dict[str, Any]:
    """
    Diagnostica a prontidão do ecossistema de scraping local do Worker sem efetuar requisições perimetrais.
    Verifica a disponibilidade de Scrapling, Camoufox, BeautifulSoup4, html2text e estado do diretório de logs.
    """
    health_status: Dict[str, Any] = {
        "status": "HEALTHY",
        "python_executable": sys.executable,
        "python_version": sys.version.split()[0],
        "logs_directory": str(LOGS_DIR),
        "logs_directory_exists": LOGS_DIR.exists(),
        "components": {}
    }

    components = {
        "scrapling": "scrapling",
        "camoufox": "camoufox",
        "beautifulsoup4": "bs4",
        "html2text": "html2text",
        "httpx": "httpx",
        "pydantic": "pydantic"
    }

    all_ok = True
    for name, module_name in components.items():
        try:
            __import__(module_name)
            health_status["components"][name] = "AVAILABLE"
        except ImportError as err:
            health_status["components"][name] = f"MISSING ({err})"
            all_ok = False

    if not all_ok:
        health_status["status"] = "DEGRADED"

    return health_status


if __name__ == "__main__":
    # Executa estritamente via STDIO (Standard I/O), sem portas de rede e sem túneis
    mcp.run(transport="stdio")
