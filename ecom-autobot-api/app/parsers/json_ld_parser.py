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
        """Retorna os dados como um dicionário para a esteira."""
        return asdict(self)


class ScrapingException(Exception):
    """
    Exceção customizada para erros de requisição e scraping.
    Armazena o código de status HTTP quando aplicável.
    """
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


class JsonLdParserService:
    """
    Serviço assíncrono para extrair dados estruturados de e-commerces.
    Utiliza JSON-LD (Schema.org) como estratégia primária e
    Open Graph Meta Tags como fallback.
    """

    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0",
    ]

    @staticmethod
    def _sanitize(text: Optional[str]) -> Optional[str]:
        """
        Passo C: Sanitização.
        Remove espaços em branco extras e tags HTML residuais das strings.
        """
        if not text:
            return None
            
        # Remover tags HTML residuais
        clean_html = re.sub(r'<[^>]+>', '', str(text))
        
        # Remover espaços em branco extras, quebras de linha e tabs
        clean_text = re.sub(r'\s+', ' ', clean_html).strip()
        
        return clean_text if clean_text else None

    def _get_random_headers(self) -> Dict[str, str]:
        """Gera headers simples com rotação de User-Agent."""
        return {
            "User-Agent": random.choice(self.USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1"
        }

    async def _fetch_html(self, url: str, client: httpx.AsyncClient = None) -> str:
        """
        Realiza a requisição HTTP de forma assíncrona com tratamento de erros.
        """
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
        """
        Busca recursivamente o nó cujo "@type" seja "Product" ou uma lista contendo "Product".
        Isso resolve casos onde o JSON-LD está num "@graph" ou em arrays profundos.
        """
        if isinstance(data, dict):
            type_val = data.get("@type")
            
            if type_val:
                if isinstance(type_val, str) and type_val.lower() == "product":
                    return data
                elif isinstance(type_val, list) and any(t.lower() == "product" for t in type_val if isinstance(t, str)):
                    return data
            
            # Se for envelopado por @graph
            if "@graph" in data:
                return self._find_product_node(data["@graph"])

            # Continua a busca nos valores do dicionário
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
        """
        Passo A: Busca e processa a tag <script type="application/ld+json">
        """
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
                    
                    # Tenta capturar SKU do MPN caso SKU padrão esteja ausente
                    if not data.sku and product_node.get("mpn"):
                         data.sku = self._sanitize(product_node.get("mpn"))

                    # Tratamento para imagem que pode ser string, dicionário ou lista
                    image = product_node.get("image")
                    if isinstance(image, str):
                        data.image_url = self._sanitize(image)
                    elif isinstance(image, list) and len(image) > 0:
                        data.image_url = self._sanitize(str(image[0])) if not isinstance(image[0], dict) else self._sanitize(image[0].get("url"))
                    elif isinstance(image, dict):
                         data.image_url = self._sanitize(image.get("url"))

                    # Tratamento para offers (preço e moeda)
                    offers = product_node.get("offers")
                    if isinstance(offers, dict):
                        data.price = self._sanitize(str(offers.get("price", "")))
                        data.currency = self._sanitize(offers.get("priceCurrency"))
                    elif isinstance(offers, list) and len(offers) > 0:
                        first_offer = offers[0]
                        if isinstance(first_offer, dict):
                            data.price = self._sanitize(str(first_offer.get("price", "")))
                            data.currency = self._sanitize(first_offer.get("priceCurrency"))

                    # Se achamos o Product Node, não precisamos continuar varrendo outros scripts
                    if data.title:
                        break
                        
            except (json.JSONDecodeError, TypeError):
                # Ignora blocos de JSON inválidos
                continue
                
        return data

    def _extract_from_open_graph(self, soup: BeautifulSoup, current_data: ProductData) -> ProductData:
        """
        Passo B: Fallback utilizando Open Graph Meta Tags.
        Preenche os dados que ainda estão ausentes.
        """
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
        """
        Método principal a ser chamado pelo Worker.
        Executa os passos da esteira na ordem solicitada:
        1. Download HTML
        2. Passo A: Extração por JSON-LD
        3. Passo B: Fallback (Open Graph) se campos vitais faltarem
        
        Retorna:
            Dict: Os dados estruturados com as chaves preenchidas (ou None).
        """
        html = await self._fetch_html(url, client)
        soup = BeautifulSoup(html, "html.parser")

        # Passo A
        product_data = self._extract_from_json_ld(soup)

        # Avalia a necessidade de ir pro Passo B (fallback)
        if not product_data.title or not product_data.description:
            product_data = self._extract_from_open_graph(soup, product_data)

        # O retorno é um dicionário, com todos os campos como None caso nenhuma estratégia tenha sucesso
        return product_data.to_dict()
