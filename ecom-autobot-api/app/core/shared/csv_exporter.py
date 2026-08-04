import csv
import io
import re
from typing import List, Dict, Union, TypeVar, AsyncGenerator, Any
from pydantic import BaseModel

T = TypeVar("T")

class CsvExportService:
    """
    Serviço dedicado à geração de arquivos CSV de produtos compatíveis com plataformas de E-commerce.
    Suporta tanto a geração pontual em memória quanto a emissão contínua em streaming por lotes.
    """
    
    @staticmethod
    def _create_slug(title: str) -> str:
        """Transforma um título em um slug (URL friendly)."""
        if not title:
            return ""
        # Remove caracteres especiais e troca espaços por hífens
        slug = re.sub(r'[^\w\s-]', '', str(title).lower())
        return re.sub(r'[\s_-]+', '-', slug).strip('-')

    @staticmethod
    def generate_shopify_csv(products: List[Union[BaseModel, object]]) -> bytes:
        """
        Gera o payload em bytes de um CSV formatado para o Shopify.
        """
        headers = [
            "Title", "URL handle", "Description", "Tags", "Status",
            "SKU", "Price", "SEO title", "SEO description", "Published on online store"
        ]
        
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=headers, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        
        for p in products:
            row = {
                "Title": getattr(p, "title", ""),
                "URL handle": CsvExportService._create_slug(getattr(p, "title", "")),
                "Description": getattr(p, "descriptionHtml", ""),
                "Tags": getattr(p, "tags", "") or "",
                "Status": getattr(p, "status", "active").lower() if isinstance(getattr(p, "status", "active"), str) else str(getattr(p.status, "value", p.status)).lower(),
                "SKU": p.variants[0].sku if hasattr(p, "variants") and p.variants else getattr(p, "sku", ""),
                "Price": p.variants[0].price if hasattr(p, "variants") and p.variants else getattr(p, "price", "0.0"),
                "SEO title": getattr(p, "seoTitle", "") or "",
                "SEO description": getattr(p, "seoDescription", "") or "",
                "Published on online store": "TRUE"
            }
            writer.writerow(row)
            
        return output.getvalue().encode('utf-8-sig')

    @staticmethod
    async def stream_shopify_csv(
        batch_generator: AsyncGenerator[List[Any], None]
    ) -> AsyncGenerator[str, None]:
        """
        Gerador assíncrono que emite chunks CSV formatados para Shopify linha a linha / lote a lote.
        Evita o acúmulo de todos os produtos na memória RAM.
        """
        headers = [
            "Title", "URL handle", "Description", "Tags", "Status",
            "SKU", "Price", "SEO title", "SEO description", "Published on online store"
        ]
        
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=headers, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        yield "\ufeff" + output.getvalue()
        
        async for batch in batch_generator:
            if not batch:
                continue
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=headers, quoting=csv.QUOTE_MINIMAL)
            for p in batch:
                title = getattr(p, "title", "") or (p.get("title", "") if isinstance(p, dict) else "")
                desc = getattr(p, "descriptionHtml", getattr(p, "description", "")) or (p.get("descriptionHtml", p.get("description", "")) if isinstance(p, dict) else "")
                tags = getattr(p, "tags", "") or (p.get("tags", "") if isinstance(p, dict) else "")
                if isinstance(tags, list):
                    tags = ", ".join(str(t) for t in tags)
                
                status_val = getattr(p, "status", "active") or (p.get("status", "active") if isinstance(p, dict) else "active")
                if hasattr(status_val, "value"):
                    status_val = status_val.value
                status_str = str(status_val).lower()

                variants = getattr(p, "variants", None) or (p.get("variants", None) if isinstance(p, dict) else None)
                sku = variants[0].sku if variants and len(variants) > 0 and hasattr(variants[0], "sku") else (variants[0].get("sku", "") if variants and len(variants) > 0 and isinstance(variants[0], dict) else getattr(p, "sku", p.get("sku", "") if isinstance(p, dict) else ""))
                price = variants[0].price if variants and len(variants) > 0 and hasattr(variants[0], "price") else (variants[0].get("price", "0.0") if variants and len(variants) > 0 and isinstance(variants[0], dict) else getattr(p, "price", p.get("price", "0.0") if isinstance(p, dict) else "0.0"))

                seo_title = getattr(p, "seoTitle", getattr(p, "seo_title", "")) or (p.get("seoTitle", p.get("seo_title", "")) if isinstance(p, dict) else "")
                seo_desc = getattr(p, "seoDescription", getattr(p, "seo_description", "")) or (p.get("seoDescription", p.get("seo_description", "")) if isinstance(p, dict) else "")

                row = {
                    "Title": title,
                    "URL handle": CsvExportService._create_slug(str(title)),
                    "Description": desc,
                    "Tags": tags,
                    "Status": status_str,
                    "SKU": sku,
                    "Price": price,
                    "SEO title": seo_title or "",
                    "SEO description": seo_desc or "",
                    "Published on online store": "TRUE"
                }
                writer.writerow(row)
            chunk = output.getvalue()
            if chunk:
                yield chunk

    @staticmethod
    def generate_nuvemshop_csv(products: List[Union[BaseModel, object]]) -> bytes:
        """
        Gera o payload em bytes de um CSV formatado para a Nuvemshop.
        """
        headers = [
            "Identificador URL", "Nome", "Preço", "Descrição", "Tags",
            "Título para SEO", "Descrição para SEO", "Exibir na loja", "Produto Físico"
        ]
        
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=headers, delimiter=';', quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        
        for p in products:
            row = {
                "Identificador URL": p.handle.pt if hasattr(p, "handle") and hasattr(p.handle, "pt") else "",
                "Nome": p.name.pt if hasattr(p, "name") and hasattr(p.name, "pt") else "",
                "Preço": p.variants[0].price if hasattr(p, "variants") and p.variants else 0.0,
                "Descrição": p.description.pt if hasattr(p, "description") and hasattr(p.description, "pt") else "",
                "Tags": getattr(p, "tags", "") or "",
                "Título para SEO": p.seo_title.pt if hasattr(p, "seo_title") and p.seo_title and hasattr(p.seo_title, "pt") else "",
                "Descrição para SEO": p.seo_description.pt if hasattr(p, "seo_description") and p.seo_description and hasattr(p.seo_description, "pt") else "",
                "Exibir na loja": "SIM" if getattr(p, "published", True) else "NÃO",
                "Produto Físico": "SIM" if getattr(p, "requires_shipping", True) else "NÃO"
            }
            writer.writerow(row)
            
        return output.getvalue().encode('utf-8-sig')

    @staticmethod
    async def stream_nuvemshop_csv(
        batch_generator: AsyncGenerator[List[Any], None]
    ) -> AsyncGenerator[str, None]:
        """
        Gerador assíncrono que emite chunks CSV formatados para Nuvemshop em streaming por lote.
        """
        headers = [
            "Identificador URL", "Nome", "Preço", "Descrição", "Tags",
            "Título para SEO", "Descrição para SEO", "Exibir na loja", "Produto Físico"
        ]
        
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=headers, delimiter=';', quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        yield "\ufeff" + output.getvalue()
        
        async for batch in batch_generator:
            if not batch:
                continue
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=headers, delimiter=';', quoting=csv.QUOTE_MINIMAL)
            for p in batch:
                handle_obj = getattr(p, "handle", None) or (p.get("handle") if isinstance(p, dict) else None)
                handle_pt = getattr(handle_obj, "pt", str(handle_obj)) if handle_obj and hasattr(handle_obj, "pt") else (handle_obj.get("pt", "") if isinstance(handle_obj, dict) else str(handle_obj or ""))
                
                name_obj = getattr(p, "name", None) or (p.get("name") if isinstance(p, dict) else None)
                name_pt = getattr(name_obj, "pt", str(name_obj)) if name_obj and hasattr(name_obj, "pt") else (name_obj.get("pt", "") if isinstance(name_obj, dict) else str(name_obj or getattr(p, "title", p.get("title", "") if isinstance(p, dict) else "")))

                variants = getattr(p, "variants", None) or (p.get("variants", None) if isinstance(p, dict) else None)
                price = variants[0].price if variants and len(variants) > 0 and hasattr(variants[0], "price") else (variants[0].get("price", 0.0) if variants and len(variants) > 0 and isinstance(variants[0], dict) else getattr(p, "price", p.get("price", 0.0) if isinstance(p, dict) else 0.0))

                desc_obj = getattr(p, "description", None) or (p.get("description") if isinstance(p, dict) else None)
                desc_pt = getattr(desc_obj, "pt", str(desc_obj)) if desc_obj and hasattr(desc_obj, "pt") else (desc_obj.get("pt", "") if isinstance(desc_obj, dict) else str(desc_obj or getattr(p, "descriptionHtml", "")))

                tags = getattr(p, "tags", "") or (p.get("tags", "") if isinstance(p, dict) else "")
                if isinstance(tags, list):
                    tags = ", ".join(str(t) for t in tags)

                seo_title_obj = getattr(p, "seo_title", getattr(p, "seoTitle", None)) or (p.get("seo_title", p.get("seoTitle")) if isinstance(p, dict) else None)
                seo_title_pt = getattr(seo_title_obj, "pt", str(seo_title_obj)) if seo_title_obj and hasattr(seo_title_obj, "pt") else (seo_title_obj.get("pt", "") if isinstance(seo_title_obj, dict) else str(seo_title_obj or ""))

                seo_desc_obj = getattr(p, "seo_description", getattr(p, "seoDescription", None)) or (p.get("seo_description", p.get("seoDescription")) if isinstance(p, dict) else None)
                seo_desc_pt = getattr(seo_desc_obj, "pt", str(seo_desc_obj)) if seo_desc_obj and hasattr(seo_desc_obj, "pt") else (seo_desc_obj.get("pt", "") if isinstance(seo_desc_obj, dict) else str(seo_desc_obj or ""))

                published = getattr(p, "published", True) if hasattr(p, "published") else (p.get("published", True) if isinstance(p, dict) else True)
                requires_shipping = getattr(p, "requires_shipping", True) if hasattr(p, "requires_shipping") else (p.get("requires_shipping", True) if isinstance(p, dict) else True)

                row = {
                    "Identificador URL": handle_pt,
                    "Nome": name_pt,
                    "Preço": price,
                    "Descrição": desc_pt,
                    "Tags": tags,
                    "Título para SEO": seo_title_pt,
                    "Descrição para SEO": seo_desc_pt,
                    "Exibir na loja": "SIM" if published else "NÃO",
                    "Produto Físico": "SIM" if requires_shipping else "NÃO"
                }
                writer.writerow(row)
            chunk = output.getvalue()
            if chunk:
                yield chunk

