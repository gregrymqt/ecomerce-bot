import json
import re
import logging
from typing import Optional, Dict, Any, Union, List

logger = logging.getLogger(__name__)

class JsonLdParserService:
    """
    Parser especializado em dados estruturados (Schema.org JSON-LD) e OpenGraph/Twitter Meta Tags.
    """

    @staticmethod
    def _sanitize(text: Optional[str]) -> Optional[str]:
        if not text:
            return None
        clean_html = re.sub(r'<[^>]+>', '', str(text))
        clean_text = re.sub(r'\s+', ' ', clean_html).strip()
        return clean_text if clean_text else None

    @staticmethod
    def _extract_price(price_val: Any) -> Optional[float]:
        if price_val is None:
            return None
        try:
            val_str = str(price_val).replace("R$", "").replace("$", "").strip()
            if "," in val_str and "." in val_str:
                val_str = val_str.replace(".", "").replace(",", ".")
            elif "," in val_str:
                val_str = val_str.replace(",", ".")
            match = re.search(r'[\d\.]+', val_str)
            if match:
                return float(match.group(0))
        except Exception:
            pass
        return None

    def _find_product_node(self, data: Union[dict, list, object]) -> Optional[dict]:
        if isinstance(data, dict):
            type_val = data.get("@type")
            if type_val:
                if isinstance(type_val, str) and type_val.lower() == "product":
                    return data
                elif isinstance(type_val, list) and any(isinstance(t, str) and t.lower() == "product" for t in type_val):
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

    def extract_from_json_ld(self, json_scripts: List[str]) -> Dict[str, Any]:
        result = {
            "title": None,
            "description": None,
            "price": None,
            "currency": "BRL",
            "sku": None,
            "brand": None,
            "category": None,
            "images": []
        }

        for raw_json in json_scripts:
            try:
                data = json.loads(raw_json)
                product_node = self._find_product_node(data)
                if product_node:
                    result["title"] = self._sanitize(product_node.get("name"))
                    result["description"] = self._sanitize(product_node.get("description"))
                    result["sku"] = self._sanitize(product_node.get("sku") or product_node.get("mpn") or product_node.get("productID"))
                    
                    brand_node = product_node.get("brand")
                    if isinstance(brand_node, dict):
                        result["brand"] = self._sanitize(brand_node.get("name"))
                    elif isinstance(brand_node, str):
                        result["brand"] = self._sanitize(brand_node)

                    result["category"] = self._sanitize(product_node.get("category"))

                    # Imagens
                    images = []
                    img_val = product_node.get("image")
                    if isinstance(img_val, list):
                        for i in img_val:
                            if isinstance(i, str):
                                images.append(i)
                            elif isinstance(i, dict) and i.get("url"):
                                images.append(i["url"])
                    elif isinstance(img_val, str):
                        images.append(img_val)
                    elif isinstance(img_val, dict) and img_val.get("url"):
                        images.append(img_val["url"])
                    result["images"] = images

                    # Ofertas / Preço
                    offers = product_node.get("offers")
                    if isinstance(offers, dict):
                        result["price"] = self._extract_price(offers.get("price"))
                        result["currency"] = offers.get("priceCurrency", "BRL")
                    elif isinstance(offers, list) and offers:
                        result["price"] = self._extract_price(offers[0].get("price"))
                        result["currency"] = offers[0].get("priceCurrency", "BRL")

                    if result["title"]:
                        break
            except Exception:
                continue

        return result
