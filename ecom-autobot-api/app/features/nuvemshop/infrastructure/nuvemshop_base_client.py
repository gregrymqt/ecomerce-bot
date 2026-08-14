import logging
from typing import Optional
import httpx

logger = logging.getLogger(__name__)


def is_rate_limit_error(exception: Exception) -> bool:
    return isinstance(exception, httpx.HTTPStatusError) and exception.response.status_code == 429


class NuvemshopBaseClient:
    """
    Cliente Base de Infraestrutura HTTP para comunicação REST com a Nuvemshop (Tiendanube).
    Fornece gerenciamento de headers, URL base e validação de escopos OAuth.
    """

    def __init__(self, store_id: str, access_token: str, app_email: str = "suporte@gregcompany.com"):
        self.store_id = str(store_id)
        self.access_token = access_token
        self.base_url = f"https://api.nuvemshop.com.br/v1/{self.store_id}"

        self.headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "User-Agent": f"EcommerceBotGreg ({app_email})",
        }

    async def validate_scopes(self, required_scope: str = "write_products") -> bool:
        url = f"{self.base_url}/store"
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=self.headers)
                if response.status_code in (401, 403):
                    return False
                response.raise_for_status()

                scopes_header = response.headers.get(
                    "X-Tiendanube-Scopes", response.headers.get("X-Supported-Scopes", "")
                )
                if not scopes_header:
                    logger.warning(f"Headers de escopo não encontrados na resposta para a loja {self.store_id}.")
                    return False

                return required_scope in scopes_header
            except httpx.HTTPStatusError as e:
                logger.error(
                    f"Erro ao tentar validar escopos na Nuvemshop [Status {e.response.status_code}]: {e.response.text}"
                )
                return False
            except Exception as e:
                logger.error(f"Falha de conexão ao validar escopos na Nuvemshop: {str(e)}")
                return False
