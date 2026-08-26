import logging
from typing import Optional, Dict, Any, List
from .scrapling_client import ScraplingEngineService
from .json_ld_parser import JsonLdParserService
from .markdown_parser import MarkdownParserService

logger = logging.getLogger(__name__)

class ScraperAndLLMParser:
    """
    Orquestrador unificado de Web Scraping e Enriquecimento:
    1. Scrapling Stealth Engine (Tier 1 HTTP TLS -> Tier 2 Camoufox Browser)
    2. Extração Determinística JSON-LD / OpenGraph
    3. Fallback Inteligente via DeepSeek Markdown LLM
    """

    def __init__(self, proxy_url: Optional[str] = None):
        self.engine = ScraplingEngineService(proxy_url=proxy_url)
        self.json_ld_parser = JsonLdParserService()
        self.markdown_parser = MarkdownParserService()

    async def parse_and_enrich(self, url: str, prompt_context: Optional[str] = None) -> Dict[str, Any]:
        logger.info(f"🕷️ [Scrapling Pipeline] Coletando página: {url}")
        page = await self.engine.fetch_page(url)

        # ─────────────────────────────────────────────────────────────
        # 1. Coleta scripts JSON-LD e Meta Tags via Scrapling / BS4
        # ─────────────────────────────────────────────────────────────
        json_scripts = []
        raw_html = ""
        
        if hasattr(page, "css"):
            try:
                json_scripts = page.css('script[type="application/ld+json"]').get_all_text()
            except Exception:
                pass
            raw_html = getattr(page, "text", "") or str(page)
        elif hasattr(page, "text"):
            raw_html = page.text
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(raw_html, "html.parser")
            json_scripts = [s.get_text() for s in soup.find_all("script", type="application/ld+json")]

        # Extração 1: JSON-LD
        extracted = self.json_ld_parser.extract_from_json_ld(json_scripts)

        # Extração 2: Meta tags se faltar campos
        if not extracted["title"] or not extracted["description"] or not extracted["price"]:
            if hasattr(page, "xpath") and hasattr(page, "css"):
                try:
                    if not extracted["title"]:
                        extracted["title"] = page.xpath('//meta[@property="og:title"]/@content').first or \
                                             page.xpath('//meta[@name="twitter:title"]/@content').first or \
                                             page.css('h1::text').first
                    if not extracted["description"]:
                        extracted["description"] = page.xpath('//meta[@property="og:description"]/@content').first or \
                                                   page.xpath('//meta[@name="description"]/@content').first
                    if not extracted["price"]:
                        p_val = page.xpath('//meta[@property="product:price:amount"]/@content').first or \
                                page.xpath('//meta[@property="og:price:amount"]/@content').first
                        extracted["price"] = self.json_ld_parser._extract_price(p_val)
                    if not extracted["images"]:
                        og_img = page.xpath('//meta[@property="og:image"]/@content').first
                        if og_img:
                            extracted["images"].append(og_img)
                except Exception as meta_err:
                    logger.debug(f"Erro ao extrair meta tags: {meta_err}")

        # ─────────────────────────────────────────────────────────────
        # 2. Fallback LLM (DeepSeek Markdown) se ainda faltar título/descrição
        # ─────────────────────────────────────────────────────────────
        model_used = "scrapling/adaptive-dom"
        if (not extracted["title"] or not extracted["description"]) and raw_html:
            logger.info(f"Dados estruturados incompletos para {url}. Acionando Fallback DeepSeek LLM.")
            llm_data = await self.markdown_parser.parse(raw_html)
            if llm_data:
                extracted["title"] = extracted["title"] or llm_data.get("title")
                extracted["description"] = extracted["description"] or llm_data.get("description")
                if not extracted["price"] and llm_data.get("price"):
                    extracted["price"] = self.json_ld_parser._extract_price(llm_data.get("price"))
                if not extracted["sku"] and llm_data.get("sku"):
                    extracted["sku"] = llm_data.get("sku")
                if not extracted["images"] and llm_data.get("image_url"):
                    extracted["images"] = [llm_data.get("image_url")]
                model_used = "deepseek/deepseek-chat"

        title = extracted.get("title") or "Produto Extraído via Scrapling"
        description = extracted.get("description") or f"Produto coletado automaticamente da fonte {url}."
        price = extracted.get("price") or 0.0

        return {
            "title": title,
            "description": description,
            "price": price,
            "sku": extracted.get("sku"),
            "brand": extracted.get("brand"),
            "category": extracted.get("category"),
            "images": extracted.get("images", []),
            "source_url": url,
            "model_used": model_used,
            "status": "PROCESSED"
        }
