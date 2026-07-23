import json
import random
import re
from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any

import httpx
from bs4 import BeautifulSoup

@dataclass
class ProductData:
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[str] = None
    currency: Optional[str] = None
    image_url: Optional[str] = None
    sku: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

class ScrapingException(Exception):
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code

class JsonLdParserService:
    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0",
    ]

    @staticmethod
    def _sanitize(text: Optional[str]) -> Optional[str]:
        if not text:
            return None
        clean_html = re.sub(r'<[^>]+>', '', str(text))
        clean_text = re.sub(r'\s+', ' ', clean_html).strip()
        return clean_text if clean_text else None

    def _get_random_headers(self) -> Dict[str, str]:
        return {
            "User-Agent": random.choice(self.USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1"
        }

    async def _fetch_html(self, url: str, client: httpx.AsyncClient = None) -> str:
        headers = self._get_random_headers()
        try:
            if client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                return response.text
            else:
                async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as temp_client:
                    response = await temp_client.get(url, headers=headers)
                    response.raise_for_status()
                    return response.text
        except httpx.HTTPStatusError as e:
            raise ScrapingException(
                f"Falha ao acessar {url}: Erro HTTP {e.response.status_code}", 
                status_code=e.response.status_code
            ) from e
        except httpx.RequestError as e:
            raise ScrapingException(
                f"Erro de conexão ao acessar {url}: {str(e)}"
            ) from e

    def _find_product_node(self, data: Any) -> Optional[Dict[str, Any]]:
        if isinstance(data, dict):
            type_val = data.get("@type")
            if type_val:
                if isinstance(type_val, str) and type_val.lower() == "product":
                    return data
                elif isinstance(type_val, list) and any(t.lower() == "product" for t in type_val if isinstance(t, str)):
                    return data
            
            if "@graph" in data:
                return self._find_product_node(data["@graph"])

            for value in data.values():
                result = self._find_product_node(value)
                if result:
                    return result

        elif isinstance(data, list):
            for item in data:
                result = self._find_product_node(item)
                if result:
                    return result
                    
        return None

    def _extract_from_json_ld(self, soup: BeautifulSoup) -> ProductData:
        data = ProductData()
        scripts = soup.find_all("script", type="application/ld+json")
        
        for script in scripts:
            if not script.string:
                continue
                
            try:
                json_content = json.loads(script.string)
                product_node = self._find_product_node(json_content)
                
                if product_node:
                    data.title = self._sanitize(product_node.get("name"))
                    data.description = self._sanitize(product_node.get("description"))
                    data.sku = self._sanitize(product_node.get("sku"))
                    
                    if not data.sku and product_node.get("mpn"):
                         data.sku = self._sanitize(product_node.get("mpn"))

                    image = product_node.get("image")
                    if isinstance(image, str):
                        data.image_url = self._sanitize(image)
                    elif isinstance(image, list) and len(image) > 0:
                        data.image_url = self._sanitize(str(image[0])) if not isinstance(image[0], dict) else self._sanitize(image[0].get("url"))
                    elif isinstance(image, dict):
                         data.image_url = self._sanitize(image.get("url"))

                    offers = product_node.get("offers")
                    if isinstance(offers, dict):
                        data.price = self._sanitize(str(offers.get("price", "")))
                        data.currency = self._sanitize(offers.get("priceCurrency"))
                    elif isinstance(offers, list) and len(offers) > 0:
                        first_offer = offers[0]
                        if isinstance(first_offer, dict):
                            data.price = self._sanitize(str(first_offer.get("price", "")))
                            data.currency = self._sanitize(first_offer.get("priceCurrency"))

                    if data.title:
                        break
                        
            except (json.JSONDecodeError, TypeError):
                continue
                
        return data

    def _extract_from_open_graph(self, soup: BeautifulSoup, current_data: ProductData) -> ProductData:
        if not current_data.title:
            og_title = soup.find("meta", property="og:title") or soup.find("meta", attrs={"name": "og:title"})
            if og_title and og_title.get("content"):
                current_data.title = self._sanitize(og_title.get("content"))

        if not current_data.description:
            og_desc = soup.find("meta", property="og:description") or soup.find("meta", attrs={"name": "og:description"})
            if og_desc and og_desc.get("content"):
                current_data.description = self._sanitize(og_desc.get("content"))

        if not current_data.image_url:
            og_image = soup.find("meta", property="og:image") or soup.find("meta", attrs={"name": "og:image"})
            if og_image and og_image.get("content"):
                current_data.image_url = self._sanitize(og_image.get("content"))
                
        return current_data

    async def parse(self, url: str, client: httpx.AsyncClient = None) -> Dict[str, Any]:
        html = await self._fetch_html(url, client)
        soup = BeautifulSoup(html, "html.parser")
        product_data = self._extract_from_json_ld(soup)

        if not product_data.title or not product_data.description:
            product_data = self._extract_from_open_graph(soup, product_data)

        return product_data.to_dict()
