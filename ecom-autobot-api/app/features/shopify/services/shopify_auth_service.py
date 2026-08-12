import logging
import uuid
from typing import Optional
import httpx
from fastapi import HTTPException, status

from app.core.config.settings import settings
from app.core.config.redis_db import redis_cache
from app.features.shopify.infrastructure.security import verify_shopify_oauth_hmac
from app.features.shopify.repositories.shopify_repository import ShopifyRepository
from app.features.shopify.services.shopify_service import ShopifyService

logger = logging.getLogger(__name__)


class ShopifyAuthService:
    """
    Serviço de Domínio para Autenticação e Fluxo OAuth 2.0 da Shopify.
    Encapsula a geração de URLs de autorização, validações criptográficas de HMAC/State,
    troca de código por tokens e integração com o repositório e registro de webhooks.
    """

    def __init__(
        self,
        shopify_repo: Optional[ShopifyRepository] = None,
    ):
        self.shopify_repo = shopify_repo or ShopifyRepository()

    async def initiate_oauth_flow(self, shop_domain: str, tenant_id: str) -> str:
        """
        Normaliza o domínio da loja, gera o token state (UUID v4), armazena no Redis por 10min (600s)
        e constrói a URL de autorização oficial da Shopify.
        """
        clean_shop = shop_domain.replace("https://", "").replace("http://", "").split("/")[0].strip().lower()
        if not clean_shop.endswith(".myshopify.com"):
            clean_shop = f"{clean_shop}.myshopify.com"

        state = str(uuid.uuid4())
        await redis_cache.set(f"shopify:oauth_state:{state}", tenant_id, expire_seconds=600)

        client_id = settings.SHOPIFY_CLIENT_ID
        scopes = settings.SHOPIFY_SCOPES
        redirect_uri = settings.SHOPIFY_REDIRECT_URI

        authorize_url = (
            f"https://{clean_shop}/admin/oauth/authorize?"
            f"client_id={client_id}&scope={scopes}&redirect_uri={redirect_uri}&state={state}&grant_options[]=offline"
        )
        logger.info(f"[ShopifyAuthService] Fluxo OAuth iniciado para a loja '{clean_shop}' (Tenant: '{tenant_id}').")
        return authorize_url

    async def handle_oauth_callback(
        self,
        query_params: dict,
        code: str,
        shop_domain: str,
        state: str,
    ) -> str:
        """
        Processa o retorno do OAuth da Shopify:
        1. Valida o state no Redis recuperando o tenant_id.
        2. Valida a assinatura HMAC Hexadecimal dos query parameters.
        3. Realiza a troca do código de autorização pelo access_token permanente.
        4. Persiste as credenciais criptografadas via ShopifyRepository.
        5. Dispara o cadastro automático de Webhooks GraphQL via ShopifyService.
        6. Retorna a URL de redirecionamento final para o frontend web.
        """
        # 1. Validação do State OAuth
        tenant_id = await redis_cache.get(f"shopify:oauth_state:{state}")
        if not tenant_id:
            logger.warning(f"[ShopifyAuthService] State OAuth expirado ou inválido: {state}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="State OAuth expirado ou inválido.",
            )

        # 2. Validação HMAC Hexadecimal
        client_secret = settings.SHOPIFY_CLIENT_SECRET
        if not verify_shopify_oauth_hmac(query_params, client_secret):
            logger.warning(f"[ShopifyAuthService] HMAC de autorização inválido para a loja '{shop_domain}'.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Assinatura HMAC de autorização inválida.",
            )

        # 3. Troca de Código por Access Token
        clean_shop = shop_domain.replace("https://", "").replace("http://", "").split("/")[0].strip().lower()
        if not clean_shop.endswith(".myshopify.com"):
            clean_shop = f"{clean_shop}.myshopify.com"

        token_url = f"https://{clean_shop}/admin/oauth/access_token"
        token_payload = {
            "client_id": settings.SHOPIFY_CLIENT_ID,
            "client_secret": client_secret,
            "code": code,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as http_client:
                res = await http_client.post(token_url, json=token_payload)
                if res.status_code != 200:
                    logger.error(f"[ShopifyAuthService] Erro na troca de código ({res.status_code}): {res.text}")
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"Erro na troca de código OAuth Shopify ({res.status_code}): {res.text}",
                    )
                token_data = res.json()
        except HTTPException:
            raise
        except Exception as err:
            logger.error(f"[ShopifyAuthService] Falha na comunicação HTTP com Shopify: {err}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Falha na comunicação HTTP com a Shopify para troca de token: {err}",
            )

        access_token = token_data.get("access_token")
        if not access_token:
            logger.error("[ShopifyAuthService] Access token ausente na resposta da Shopify.")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Access token não retornado pela API da Shopify.",
            )

        # 4. Salvar integração e cadastrar Webhooks
        await self.shopify_repo.save_integration(tenant_id=tenant_id, shop_domain=clean_shop, access_token=access_token)

        shopify_service = ShopifyService(tenant_id=tenant_id)
        await shopify_service.register_app_webhooks(shop_domain=clean_shop, access_token=access_token)

        # 5. URL de Redirecionamento Final
        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
        redirect_target = f"{frontend_url}/catalog?shopify_connected=true&shop={clean_shop}"
        logger.info(f"[ShopifyAuthService] OAuth concluído com sucesso para a loja '{clean_shop}' no tenant '{tenant_id}'.")
        return redirect_target
