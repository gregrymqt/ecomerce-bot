from dataclasses import dataclass


@dataclass
class ShopifyCredentials:
    """Entidade de domínio com as credenciais autenticadas da Shopify para um tenant."""
    shop_domain: str
    access_token: str
