import csv
import io
import re
from typing import List, Dict, Any

class CsvExportService:
    """
    Serviço dedicado à geração de arquivos CSV de produtos compatíveis com plataformas de E-commerce.
    """
    
    @staticmethod
    def _create_slug(title: str) -> str:
        """Transforma um título em um slug (URL friendly)."""
        if not title:
            return ""
        # Remove caracteres especiais e troca espaços por hífens
        slug = re.sub(r'[^\w\s-]', '', title.lower())
        return re.sub(r'[\s_-]+', '-', slug).strip('-')

    @staticmethod
    def generate_shopify_csv(products: List[Any]) -> bytes:
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
                "Status": getattr(p, "status", "active").lower(),
                "SKU": p.variants[0].sku if hasattr(p, "variants") and p.variants else "",
                "Price": p.variants[0].price if hasattr(p, "variants") and p.variants else "0.0",
                "SEO title": getattr(p, "seoTitle", "") or "",
                "SEO description": getattr(p, "seoDescription", "") or "",
                "Published on online store": "TRUE"
            }
            writer.writerow(row)
            
        return output.getvalue().encode('utf-8-sig')

    @staticmethod
    def generate_nuvemshop_csv(products: List[Any]) -> bytes:
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
