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

    async def _fetch_and_parse_shopify_json(self, url: str) -> Optional[Dict[str, Any]]:
        """
        Atalho assíncrono ultra-rápido para URLs .json nativas da Shopify sem sobrecarga de navegador headless.
        """
        try:
            import httpx
            import re
            from app.core.shared.security import validate_url_safety

            validate_url_safety(url)

            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
                resp = await client.get(
                    url,
                    headers={
                        "Accept": "application/json, text/plain, */*",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
                    }
                )
                if resp.status_code != 200:
                    logger.warning(f"Endpoint JSON retornou status {resp.status_code} para {url}")
                    return None

                data = resp.json()
                product = data.get("product") if isinstance(data, dict) else None
                if not product or not isinstance(product, dict):
                    return None

                title = product.get("title") or "Produto Shopify"
                raw_html_body = product.get("body_html") or ""
                clean_desc = re.sub(r"<[^>]+>", " ", raw_html_body)
                clean_desc = re.sub(r"\s+", " ", clean_desc).strip()
                description = clean_desc or f"Produto Shopify extraído com sucesso de {url}."

                variants = product.get("variants", [])
                price = 0.0
                sku = None
                if variants and isinstance(variants, list) and isinstance(variants[0], dict):
                    price_val = variants[0].get("price")
                    try:
                        price = float(price_val) if price_val is not None else 0.0
                    except (ValueError, TypeError):
                        price = 0.0
                    sku = str(variants[0].get("sku") or variants[0].get("id") or "")

                brand = product.get("vendor") or "Loja Shopify"
                category = product.get("product_type") or "Geral"

                images = []
                raw_images = product.get("images", [])
                if isinstance(raw_images, list):
                    for img in raw_images:
                        if isinstance(img, dict) and img.get("src"):
                            images.append(img["src"])
                        elif isinstance(img, str):
                            images.append(img)

                logger.info(f"Extração JSON nativa Shopify bem-sucedida para {url}: {title}")
                return {
                    "title": title,
                    "description": description,
                    "price": price,
                    "sku": sku,
                    "brand": brand,
                    "category": category,
                    "images": images,
                    "source_url": url,
                    "model_used": "shopify/native-json-api",
                    "status": "PROCESSED"
                }
        except Exception as err:
            logger.warning(f"Falha ao processar URL como JSON nativo ({url}): {err}")
            return None

    async def parse_and_enrich(self, url: str, prompt_context: Optional[str] = None) -> Dict[str, Any]:
        # 0. Atalho inteligente: Se a URL terminar em .json, processa diretamente via httpx
        if url.strip().lower().endswith(".json"):
            logger.info(f"Detectada URL terminada em .json ({url}). Acionando atalho assíncrono httpx...")
            shopify_result = await self._fetch_and_parse_shopify_json(url)
            if shopify_result:
                return shopify_result

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
