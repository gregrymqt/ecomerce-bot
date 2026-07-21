import csv
import io
import re
from typing import List, Dict

from app.models.nuvemshop_models import NuvemshopProductRequest
from app.models.shopify_models import ShopifyProductSetInput

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
    def generate_shopify_csv(products: List[ShopifyProductSetInput]) -> bytes:
        """
        Gera o payload em bytes de um CSV formatado para o Shopify.
        """
        headers = [
            "Title", "URL handle", "Description", "Tags", "Status",
            "SKU", "Price", "SEO title", "SEO description", "Published on online store"
        ]
        
        output = io.StringIO()
        # O Shopify aceita delimitador padrão ',' e escape por aspas.
        writer = csv.DictWriter(output, fieldnames=headers, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        
        for p in products:
            row = {
                "Title": p.title,
                "URL handle": CsvExportService._create_slug(p.title),
                "Description": p.descriptionHtml,
                "Tags": p.tags or "",
                "Status": p.status.lower(),
                "SKU": p.variants[0].sku if p.variants else "",
                "Price": p.variants[0].price if p.variants else "0.0",
                "SEO title": p.seoTitle or "",
                "SEO description": p.seoDescription or "",
                "Published on online store": "TRUE"
            }
            writer.writerow(row)
            
        # O formato utf-8-sig (com BOM) é vital para o Excel carregar a codificação corretamente
        return output.getvalue().encode('utf-8-sig')

    @staticmethod
    def generate_nuvemshop_csv(products: List[NuvemshopProductRequest]) -> bytes:
        """
        Gera o payload em bytes de um CSV formatado para a Nuvemshop.
        """
        headers = [
            "Identificador URL", "Nome", "Preço", "Descrição", "Tags",
            "Título para SEO", "Descrição para SEO", "Exibir na loja", "Produto Físico"
        ]
        
        output = io.StringIO()
        # Nuvemshop utiliza comumente o delimitador ';'
        writer = csv.DictWriter(output, fieldnames=headers, delimiter=';', quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        
        for p in products:
            row = {
                "Identificador URL": p.handle.pt,
                "Nome": p.name.pt,
                "Preço": p.variants[0].price if p.variants else 0.0,
                "Descrição": p.description.pt,
                "Tags": p.tags or "",
                "Título para SEO": p.seo_title.pt if p.seo_title else "",
                "Descrição para SEO": p.seo_description.pt if p.seo_description else "",
                "Exibir na loja": "SIM" if p.published else "NÃO",
                "Produto Físico": "SIM" if p.requires_shipping else "NÃO"
            }
            writer.writerow(row)
            
        return output.getvalue().encode('utf-8-sig')
