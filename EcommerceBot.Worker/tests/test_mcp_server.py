import pytest
from unittest.mock import AsyncMock, patch
from mcp_server import check_scraper_health, read_scraper_logs, test_scrape_url, LOGS_DIR


def test_check_scraper_health():
    """Valida o diagnóstico de saúde e disponibilidade dos componentes."""
    health = check_scraper_health()
    assert "status" in health
    assert health["status"] in ["HEALTHY", "DEGRADED"]
    assert "components" in health
    assert "beautifulsoup4" in health["components"]
    assert "html2text" in health["components"]


def test_read_scraper_logs(tmp_path):
    """Valida a leitura e filtragem de logs persistidos."""
    # Cria arquivo de log temporário no diretório de logs
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    temp_log_file = LOGS_DIR / "test_temp_worker.log"
    temp_log_file.write_text(
        "INFO 2026-09-22 10:00:00 [worker] Iniciando worker\n"
        "ERROR 2026-09-22 10:01:00 [scraper] HTTP 403 Forbidden para https://loja.com\n"
        "INFO 2026-09-22 10:02:00 [scraper] Scraping concluído para SKU 123\n",
        encoding="utf-8"
    )

    try:
        # Leitura com filtro
        filtered_output = read_scraper_logs(lines=10, filter_query="403")
        assert "HTTP 403 Forbidden" in filtered_output
        assert "Filtro: '403'" in filtered_output

        # Leitura sem filtro
        full_output = read_scraper_logs(lines=10)
        assert "Iniciando worker" in full_output
        assert "Scraping concluído" in full_output
    finally:
        if temp_log_file.exists():
            temp_log_file.unlink()


@pytest.mark.asyncio
async def test_scrape_url_blocked_on_ssrf_attempt():
    """Valida se URLs de loopback e metadados de nuvem são bloqueadas via Anti-SSRF."""
    blocked_loopback = await test_scrape_url("http://127.0.0.1:8000/admin")
    assert blocked_loopback["status"] == "BLOCKED"
    assert blocked_loopback["security_policy"] == "Anti-SSRF Fail-Closed"
    assert "loopback" in blocked_loopback["reason"].lower()

    blocked_metadata = await test_scrape_url("http://169.254.169.254/latest/meta-data")
    assert blocked_metadata["status"] == "BLOCKED"
    assert blocked_metadata["security_policy"] == "Anti-SSRF Fail-Closed"


@pytest.mark.asyncio
async def test_scrape_url_dry_run_success():
    """Valida o dry-run com extração simulada sem efeitos colaterais de mensageria."""
    mock_result = {
        "title": "Vestido Canelado Teste Dry-Run",
        "raw_title": "Vestido Canelado Teste Dry-Run",
        "category": "Moda Feminina > Vestidos",
        "brand": "Marca Teste",
        "price": 149.90,
        "currency": "BRL",
        "images": ["https://loja.com/img1.jpg"],
        "raw_markdown": "# Vestido Canelado\nConfortável e elegante.",
        "description": "Confortável e elegante.",
        "raw_description_html": "<p>Confortável e elegante.</p>",
        "model_used": "scrapling/adaptive-dom"
    }

    with patch("mcp_server.ScraperParser") as mock_parser_cls:
        mock_instance = mock_parser_cls.return_value
        mock_instance.parse_and_enrich = AsyncMock(return_value=mock_result)

        response = await test_scrape_url("https://lojaexemplo.com.br/vestido-teste")

        assert response["status"] == "SUCCESS"
        assert response["title"] == "Vestido Canelado Teste Dry-Run"
        assert response["category"] == "Moda Feminina > Vestidos"
        assert response["price"] == 149.90
        assert response["images_count"] == 1
        assert "Vestido Canelado" in response["markdown_preview"]
        assert response["protection_tier_used"] == "scrapling/adaptive-dom"
