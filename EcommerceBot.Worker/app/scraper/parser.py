import logging
import re
from typing import Optional, Dict, Any, List, Tuple
from bs4 import BeautifulSoup
import html2text
from .scrapling_client import ScraplingEngineService
from .json_ld_parser import JsonLdParserService

logger = logging.getLogger(__name__)


def clean_html_and_convert_to_markdown(raw_html: str, max_markdown_chars: int = 15000) -> Tuple[str, str]:
    """
    Higieniza o HTML removendo scripts e blocos irrelevantes e converte deterministamente
    para Markdown puro sem qualquer dependência ou chamada de IA.
    """
    if not raw_html:
        return "", ""

    try:
        soup = BeautifulSoup(raw_html, "html.parser")
        for tag in ["script", "style", "nav", "footer", "header", "iframe", "noscript", "svg"]:
            for el in soup.find_all(tag):
                el.decompose()

        main_content = soup.find("main") or soup.find("article") or soup.find("body") or soup
        clean_html = str(main_content)

        converter = html2text.HTML2Text()
        converter.ignore_links = False
        converter.ignore_images = True
        converter.ignore_tables = False
        converter.body_width = 0
        markdown_text = converter.handle(clean_html).strip()

        if len(markdown_text) > max_markdown_chars:
            markdown_text = markdown_text[:max_markdown_chars] + "\n...[truncated]"

        return clean_html, markdown_text
    except Exception as ex:
        logger.warning(f"Falha na conversão de HTML para Markdown: {ex}")
        return raw_html, ""


class ScraperParser:
    """
    Motor unificado de Web Scraping determinístico perimetral (Read-to-Raw):
    1. Scrapling Stealth Engine (Tier 1 HTTP TLS -> Tier 2 Camoufox Browser)
    2. Extração Determinística JSON-LD / OpenGraph / Microdata
    3. Conversão estruturada de HTML para Markdown determinístico
    ZERO chamadas e ZERO dependências de LLM.
    """

    def __init__(self, proxy_url: Optional[str] = None):
        self.engine = ScraplingEngineService(proxy_url=proxy_url)
        self.json_ld_parser = JsonLdParserService()

    async def _fetch_and_parse_shopify_json(self, url: str) -> Optional[Dict[str, Any]]:
        """
        Atalho assíncrono ultra-rápido para URLs .json nativas da Shopify sem sobrecarga de navegador headless.
        """
        try:
            import httpx
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

                meta_attrs = {
                    "brand": str(brand),
                    "category": str(category),
                    "source": "shopify_json"
                }

                logger.info(f"Extração JSON nativa Shopify bem-sucedida para {url}: {title}")
                return {
                    "title": title,
                    "raw_title": title,
                    "description": description,
                    "raw_description_html": raw_html_body,
                    "raw_markdown": description,
                    "price": price,
                    "currency": "BRL",
                    "sku": sku,
                    "brand": brand,
                    "category": category,
                    "images": images,
                    "meta_attributes": meta_attrs,
                    "source_url": url,
                    "model_used": "shopify/native-json-api",
                    "status": "PROCESSED"
                }
        except Exception as err:
            logger.warning(f"Falha ao processar URL como JSON nativo ({url}): {err}")
            return None

    async def parse_and_enrich(self, url: str, prompt_context: Optional[str] = None) -> Dict[str, Any]:
        """
        Executa a extração perimetral do produto via Scrapling, JSON-LD e conversão para Markdown.
        Retorna os dados brutos estruturados para publicação no RabbitMQ.
        """
        # 0. Atalho inteligente: Se a URL terminar em .json, processa diretamente via httpx
        if url.strip().lower().endswith(".json"):
            logger.info(f"Detectada URL terminada em .json ({url}). Acionando atalho assíncrono httpx...")
            shopify_result = await self._fetch_and_parse_shopify_json(url)
            if shopify_result:
                return shopify_result

        logger.info(f"🕷️ [Scrapling Pipeline] Coletando página perimetral: {url}")
        page = await self.engine.fetch_page(url)

        # ─────────────────────────────────────────────────────────────
        # 1. Coleta scripts JSON-LD e HTML bruto
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
            soup = BeautifulSoup(raw_html, "html.parser")
            json_scripts = [s.get_text() for s in soup.find_all("script", type="application/ld+json")]

        # Extração 1: JSON-LD determinístico
        extracted = self.json_ld_parser.extract_from_json_ld(json_scripts)

        # Extração 2: Meta tags / OpenGraph se faltarem campos essenciais
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
        # 2. Conversão Determinística de HTML para Markdown
        # ─────────────────────────────────────────────────────────────
        clean_html, markdown_text = clean_html_and_convert_to_markdown(raw_html)

        title = extracted.get("title") or "Produto Extraído via Scrapling"
        description = extracted.get("description") or markdown_text or f"Produto coletado automaticamente da fonte {url}."
        price = extracted.get("price") or 0.0

        meta_attributes = {
            "brand": str(extracted.get("brand") or ""),
            "category": str(extracted.get("category") or ""),
            "model_used": "scrapling/adaptive-dom",
            "source_url": url,
        }

        return {
            "title": title,
            "raw_title": title,
            "description": description,
            "raw_description_html": clean_html or raw_html,
            "raw_markdown": markdown_text or description,
            "price": price,
            "currency": "BRL",
            "sku": extracted.get("sku"),
            "brand": extracted.get("brand"),
            "category": extracted.get("category"),
            "images": extracted.get("images", []),
            "meta_attributes": meta_attributes,
            "source_url": url,
            "model_used": "scrapling/adaptive-dom",
            "status": "PROCESSED"
        }


# Alias de compatibilidade total para testes e consumidores legados
ScraperAndLLMParser = ScraperParser
