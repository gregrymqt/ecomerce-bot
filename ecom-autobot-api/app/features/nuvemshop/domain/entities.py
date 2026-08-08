from dataclasses import dataclass


@dataclass
class NuvemshopCredentials:
    """Entidade de domínio com as credenciais autenticadas da Nuvemshop para um tenant."""
    store_id: str
    access_token: str
    app_email: str
