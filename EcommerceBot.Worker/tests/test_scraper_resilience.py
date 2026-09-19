import asyncio
import hashlib
import json
import unittest
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.core.shared.security import validate_url_safety
from app.scraper.schemas import ScrapingRequest, ScrapedRawProductEvent, ProductEnrichmentMetadata
from app.scraper.json_ld_parser import JsonLdParserService
from app.scraper.parser import clean_html_and_convert_to_markdown
from app.scraper.worker import _process_single_message, QUEUE_OUTPUT
from app.core.config.rabbitmq import QUEUE_ECOMMERCE_SCRAPED


class TestScraperResilienceSuite(unittest.IsolatedAsyncioTestCase):
    """
    Suíte de Testes Automatizados de Resiliência do Scraper (ECom-Auto-Bot SaaS).
    Valida as garantias fail-closed, evasão de bots, proteção anti-SSRF,
    extração pura determinística e publicação de ScrapedRawProductEvent em ecommerce_scraped_queue.
    """

    def setUp(self):
        self.tenant_id = "569f36b8-23a7-448a-806a-71b8ddbede98"
        self.sku = "SKU-RESILIENCE-TEST-001"
        self.valid_url = "https://loja-exemplo.com.br/products/tenis-corrida"

    # -------------------------------------------------------------------------
    # 1. Anti-SSRF & Proteção Perimetral de Rede [QA-SCR-01]
    # -------------------------------------------------------------------------
    def test_anti_ssrf_blocks_private_and_loopback_urls(self):
        """Valida que URLs de loopback, RFC 1918 e metadados de nuvem são rejeitadas preventivamente."""
        blocked_urls = [
            "http://127.0.0.1:8000/api",
            "http://localhost:5672",
            "http://169.254.169.254/latest/meta-data",
            "http://10.0.0.5:9000",
            "http://192.168.1.1/setup",
            "http://172.16.0.2:3306",
            "file:///etc/passwd",
            "ftp://ftp.example.com/files",
            "gopher://evil.com",
        ]
        for url in blocked_urls:
            with self.assertRaises(ValueError, msg=f"A URL '{url}' deveria ter sido bloqueada pelo filtro Anti-SSRF"):
                validate_url_safety(url)

    async def test_anti_ssrf_worker_emits_failed_event_and_refund_contract(self):
        """Valida que quando uma URL maliciosa é enviada, o ScraperWorker publica ScrapedRawProductEvent com Success=False."""
        channel_mock = MagicMock()
        channel_mock.default_exchange = MagicMock()
        channel_mock.default_exchange.publish = AsyncMock()

        parser_mock = MagicMock()
        parser_mock.parse_and_enrich = AsyncMock()

        # Payload com URL tentando acessar localhost (SSRF)
        request_payload = {
            "tenant_id": self.tenant_id,
            "sku": self.sku,
            "url": "http://127.0.0.1:8080/admin/credentials",
            "prompt_context": "",
            "is_byok": False
        }
        body_bytes = json.dumps(request_payload).encode("utf-8")

        message_mock = MagicMock()
        message_mock.body = body_bytes
        message_mock.process.return_value.__aenter__ = AsyncMock()
        message_mock.process.return_value.__aexit__ = AsyncMock()

        with patch("app.scraper.worker.redis_cache.is_already_processed", new=AsyncMock(return_value=False)):
            await _process_single_message(message_mock, channel_mock, parser_mock)

        # O parser nunca deve ser chamado
        parser_mock.parse_and_enrich.assert_not_called()

        # O evento com Success=False deve ser publicado no ecommerce_scraped_queue para tratamento no Core C#
        channel_mock.default_exchange.publish.assert_called_once()
        published_call = channel_mock.default_exchange.publish.call_args
        published_msg = published_call[0][0]
        self.assertEqual(published_call[1]["routing_key"], QUEUE_ECOMMERCE_SCRAPED)
        published_data = json.loads(published_msg.body.decode("utf-8"))

        self.assertEqual(published_data["tenantId"], self.tenant_id)
        self.assertEqual(published_data["sku"], self.sku)
        self.assertFalse(published_data["success"])
        self.assertIn("Bloqueio de rede / Anti-SSRF", published_data["errorMessage"])

    # -------------------------------------------------------------------------
    # 2. Idempotência Operacional no Redis via SHA-256 da URL Canônica [QA-SCR-06]
    # -------------------------------------------------------------------------
    async def test_idempotency_prevents_duplicate_scraping(self):
        """Valida que mensagens duplicadas no RabbitMQ são descartadas sem gastar scrapers baseado no SHA-256 da URL."""
        channel_mock = MagicMock()
        channel_mock.default_exchange.publish = AsyncMock()

        parser_mock = MagicMock()
        parser_mock.parse_and_enrich = AsyncMock()

        request_payload = {
            "tenant_id": self.tenant_id,
            "sku": self.sku,
            "url": self.valid_url,
            "prompt_context": "",
            "is_byok": False
        }
        message_mock = MagicMock()
        message_mock.body = json.dumps(request_payload).encode("utf-8")
        message_mock.process.return_value.__aenter__ = AsyncMock()
        message_mock.process.return_value.__aexit__ = AsyncMock()

        mock_is_processed = AsyncMock(return_value=True)
        with patch("app.scraper.worker.redis_cache.is_already_processed", new=mock_is_processed):
            await _process_single_message(message_mock, channel_mock, parser_mock)

        canonical_url = self.valid_url.strip().lower()
        expected_hash = hashlib.sha256(canonical_url.encode("utf-8")).hexdigest()
        expected_key = f"worker:idempotency:scraper:{self.tenant_id}:{expected_hash}"
        mock_is_processed.assert_called_once_with(expected_key)

        # Deve descartar silenciosamente
        parser_mock.parse_and_enrich.assert_not_called()
        channel_mock.default_exchange.publish.assert_not_called()

    # -------------------------------------------------------------------------
    # 3. Tratamento de Payload Malformado / Pydantic Validation
    # -------------------------------------------------------------------------
    async def test_malformed_pydantic_payload_emits_failed_event(self):
        """Valida que mensagens com schema inválido não causam travamento e emitem evento de erro estruturado."""
        channel_mock = MagicMock()
        channel_mock.default_exchange.publish = AsyncMock()

        parser_mock = MagicMock()
        parser_mock.parse_and_enrich = AsyncMock()

        # Payload faltando a URL (campo obrigatório)
        invalid_payload = {
            "tenantId": self.tenant_id,
            "productId": self.sku,
            # url ausente
        }
        message_mock = MagicMock()
        message_mock.body = json.dumps(invalid_payload).encode("utf-8")
        message_mock.process.return_value.__aenter__ = AsyncMock()
        message_mock.process.return_value.__aexit__ = AsyncMock()

        await _process_single_message(message_mock, channel_mock, parser_mock)

        parser_mock.parse_and_enrich.assert_not_called()
        channel_mock.default_exchange.publish.assert_called_once()
        published_call = channel_mock.default_exchange.publish.call_args
        self.assertEqual(published_call[1]["routing_key"], QUEUE_ECOMMERCE_SCRAPED)
        published_msg = published_call[0][0]
        published_data = json.loads(published_msg.body.decode("utf-8"))

        self.assertFalse(published_data["success"])
        self.assertEqual(published_data["sku"], self.sku)
        self.assertIn("erro(s) de validação", published_data["errorMessage"])

    # -------------------------------------------------------------------------
    # 4. Edge Cases de HTML & JSON-LD Ausente ou Corrompido [QA-SCR-03]
    # -------------------------------------------------------------------------
    def test_missing_json_ld_fallback_returns_safe_defaults(self):
        """Valida que páginas sem Schema.org retornam estrutura padrão limpa sem levantar exceções."""
        parser = JsonLdParserService()
        result = parser.extract_from_json_ld([])

        self.assertIsNone(result["title"])
        self.assertIsNone(result["price"])
        self.assertIsNone(result["sku"])
        self.assertEqual(result["images"], [])

    def test_corrupted_json_ld_syntax_resilience(self):
        """Valida que scripts JSON-LD com sintaxe truncada ou inválida são ignorados graciosamente."""
        parser = JsonLdParserService()
        corrupted_scripts = [
            '{"@context": "https://schema.org", "@type": "Product", "name": "Produto Incompleto',
            'Texto aleatorio sem JSON',
            '{"@type": "NewsArticle", "headline": "Nao e produto"}'
        ]
        result = parser.extract_from_json_ld(corrupted_scripts)
        self.assertIsNone(result["title"])

    # -------------------------------------------------------------------------
    # 5. Higienização de HTML e Conversão Determinística para Markdown [QA-SCR-04]
    # -------------------------------------------------------------------------
    def test_clean_html_and_markdown_conversion(self):
        """Valida a sanitização de tags perigosas e conversão limpa para Markdown."""
        malicious_html = """
        <html>
            <head><script>alert('xss')</script></head>
            <body>
                <header><nav>Home | Login</nav></header>
                <main>
                    <h1>Tênis Runner Pro</h1>
                    <p>Preço: R$ 299,90</p>
                    <div class="description">
                        Produto de alta performance para corredores profissionais.
                    </div>
                </main>
                <footer>Termos e Condições</footer>
            </body>
        </html>
        """
        clean_html, markdown = clean_html_and_convert_to_markdown(malicious_html)
        # Scripts e navegações devem ser eliminados
        self.assertNotIn("<script>", clean_html)
        self.assertNotIn("<nav>", clean_html)
        self.assertNotIn("<footer>", clean_html)
        self.assertIn("Tênis Runner Pro", clean_html)
        self.assertIn("Tênis Runner Pro", markdown)
        self.assertIn("299,90", markdown)

    # -------------------------------------------------------------------------
    # 6. Resiliência a Falhas do Scraper / Timeout [QA-SCR-05 & QA-SCR-07]
    # -------------------------------------------------------------------------
    async def test_scraping_failure_graceful_handling_and_refund_event(self):
        """Valida que falhas na extração de scraping geram ScrapedRawProductEvent com Success=False para o C#."""
        channel_mock = MagicMock()
        channel_mock.default_exchange.publish = AsyncMock()

        parser_mock = MagicMock()
        parser_mock.parse_and_enrich = AsyncMock(side_effect=TimeoutError("Scrapling connection timeout after 30s"))

        request_payload = {
            "tenant_id": self.tenant_id,
            "sku": self.sku,
            "url": self.valid_url,
            "prompt_context": "",
            "is_byok": False
        }
        message_mock = MagicMock()
        message_mock.body = json.dumps(request_payload).encode("utf-8")
        message_mock.process.return_value.__aenter__ = AsyncMock()
        message_mock.process.return_value.__aexit__ = AsyncMock()

        with patch("app.scraper.worker.redis_cache.is_already_processed", new=AsyncMock(return_value=False)), \
             patch("app.scraper.worker.validate_url_safety"):
            await _process_single_message(message_mock, channel_mock, parser_mock)

        # Deve publicar na fila de scraping intermediária com success=False
        channel_mock.default_exchange.publish.assert_called_once()
        published_call = channel_mock.default_exchange.publish.call_args
        self.assertEqual(published_call[1]["routing_key"], QUEUE_ECOMMERCE_SCRAPED)
        published_msg = published_call[0][0]
        published_data = json.loads(published_msg.body.decode("utf-8"))

        self.assertFalse(published_data["success"])
        self.assertEqual(published_data["sku"], self.sku)
        self.assertIn("Scrapling connection timeout", published_data["errorMessage"])

    # -------------------------------------------------------------------------
    # 7. Fluxo Normal com Publicação de Dados Brutos em ecommerce_scraped_queue [QA-SCR-02]
    # -------------------------------------------------------------------------
    async def test_successful_scraping_emits_raw_event_to_scraped_queue(self):
        """Valida que o scraping bem-sucedido emite o ScrapedRawProductEvent diretamente em ecommerce_scraped_queue."""
        channel_mock = MagicMock()
        channel_mock.default_exchange.publish = AsyncMock()

        parser_mock = MagicMock()
        parser_mock.parse_and_enrich = AsyncMock(return_value={
            "title": "Tênis Yuool Fit",
            "raw_title": "Tênis Yuool Fit",
            "description": "Tênis sustentável confeccionado em lã merino.",
            "raw_description_html": "<p>Tênis sustentável confeccionado em lã merino.</p>",
            "raw_markdown": "Tênis sustentável confeccionado em lã merino.",
            "price": 499.00,
            "currency": "BRL",
            "brand": "Yuool",
            "category": "Calçados",
            "images": ["https://cdn.yuool.com/img1.jpg"],
            "meta_attributes": {"brand": "Yuool", "category": "Calçados"}
        })

        request_payload = {
            "tenant_id": self.tenant_id,
            "sku": self.sku,
            "url": self.valid_url,
            "prompt_context": "Tom persuasivo e elegante",
            "is_byok": True
        }
        message_mock = MagicMock()
        message_mock.body = json.dumps(request_payload).encode("utf-8")
        message_mock.process.return_value.__aenter__ = AsyncMock()
        message_mock.process.return_value.__aexit__ = AsyncMock()

        mock_set_idempotency = AsyncMock()
        with patch("app.scraper.worker.redis_cache.is_already_processed", new=AsyncMock(return_value=False)), \
             patch("app.scraper.worker.validate_url_safety"), \
             patch("app.scraper.worker.redis_cache.set_idempotency_key", new=mock_set_idempotency):
            await _process_single_message(message_mock, channel_mock, parser_mock)

        # Deve ser realizada exatamente 1 publicação em ecommerce_scraped_queue (zero chamadas a llm_usage_queue)
        self.assertEqual(channel_mock.default_exchange.publish.call_count, 1)

        published_call = channel_mock.default_exchange.publish.call_args
        self.assertEqual(published_call[1]["routing_key"], QUEUE_ECOMMERCE_SCRAPED)
        published_data = json.loads(published_call[0][0].body.decode("utf-8"))

        self.assertEqual(published_data["tenantId"], self.tenant_id)
        self.assertEqual(published_data["sku"], self.sku)
        self.assertTrue(published_data["success"])
        self.assertEqual(published_data["rawTitle"], "Tênis Yuool Fit")
        self.assertEqual(published_data["price"], 499.00)
        self.assertEqual(published_data["images"], ["https://cdn.yuool.com/img1.jpg"])
        self.assertEqual(published_data["promptContext"], "Tom persuasivo e elegante")
        self.assertIsNone(published_data["errorMessage"])

        # Idempotência salva no Redis com o hash SHA-256 da URL canônica
        mock_set_idempotency.assert_called_once()
        saved_key = mock_set_idempotency.call_args[0][0]
        self.assertIn("worker:idempotency:scraper", saved_key)
        self.assertIn(hashlib.sha256(self.valid_url.strip().lower().encode("utf-8")).hexdigest(), saved_key)

    # -------------------------------------------------------------------------
    # 8. Limite de Concorrência no Tier 2 via Semáforo de RAM [QA-SCR-02]
    # -------------------------------------------------------------------------
    async def test_tier2_browser_semaphore_limits_concurrency(self):
        """Valida que instâncias concorrentes de Stealth Browser são limitadas pelo semáforo assíncrono para evitar OOM na VPS."""
        from app.scraper.scrapling_client import ScraplingEngineService, get_browser_semaphore

        service = ScraplingEngineService()
        semaphore = get_browser_semaphore(max_concurrency=2)

        # Simula semáforo saturado (2 vagas já alocadas por requisições concorrentes)
        await semaphore.acquire()
        await semaphore.acquire()

        try:
            with patch.object(service, "fetch_tier1_http", new=AsyncMock(return_value="tier1_fallback_response")) as mock_tier1:
                res = await service.fetch_tier2_browser("https://example.com/item", timeout=0.1)
                self.assertEqual(res, "tier1_fallback_response")
                mock_tier1.assert_called_once()
        finally:
            semaphore.release()
            semaphore.release()

    # -------------------------------------------------------------------------
    # 9. Contrato de Estorno de Crédito no Ledger [QA-SCR-07]
    # -------------------------------------------------------------------------
    async def test_ledger_refund_contract(self):
        """Valida o contrato de emissão de evento com Success=False que permite o estorno no Ledger pelo C#."""
        channel_mock = MagicMock()
        channel_mock.default_exchange.publish = AsyncMock()

        parser_mock = MagicMock()
        parser_mock.parse_and_enrich = AsyncMock(side_effect=RuntimeError("Falha de DNS do e-commerce de destino"))

        request_payload = {
            "tenant_id": self.tenant_id,
            "sku": self.sku,
            "url": self.valid_url,
            "prompt_context": "",
            "is_byok": False
        }
        message_mock = MagicMock()
        message_mock.body = json.dumps(request_payload).encode("utf-8")
        message_mock.process.return_value.__aenter__ = AsyncMock()
        message_mock.process.return_value.__aexit__ = AsyncMock()

        with patch("app.scraper.worker.redis_cache.is_already_processed", new=AsyncMock(return_value=False)), \
             patch("app.scraper.worker.validate_url_safety"):
            await _process_single_message(message_mock, channel_mock, parser_mock)

        channel_mock.default_exchange.publish.assert_called_once()
        published_call = channel_mock.default_exchange.publish.call_args
        self.assertEqual(published_call[1]["routing_key"], QUEUE_ECOMMERCE_SCRAPED)
        published_data = json.loads(published_call[0][0].body.decode("utf-8"))

        self.assertFalse(published_data["success"])
        self.assertEqual(published_data["tenantId"], self.tenant_id)
        self.assertEqual(published_data["sku"], self.sku)
        self.assertIn("Falha de DNS", published_data["errorMessage"])
