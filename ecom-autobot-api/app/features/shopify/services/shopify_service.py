import logging
from typing import Optional
from fastapi import HTTPException, status
from fastapi.responses import JSONResponse

from app.core.config.settings import settings
from app.core.shared.csv_exporter import CsvExportService
from app.features.shopify.infrastructure.client import ShopifyClient
from app.features.shopify.repositories import ShopifyRepository
from app.features.products.repositories.product_repository import ProductRepository
from app.features.shopify.schemas import (
    ShopifyMediaAddRequest,
    ShopifyProductSetInput,
)

logger = logging.getLogger(__name__)


class ShopifyService:
    """
    Serviço de Lógica de Negócio para o Shopify.
    Consome o ShopifyRepository (para credenciais) e o ShopifyClient (para a API GraphQL).
    """

    def __init__(
        self,
        tenant_id: str,
        shopify_repo: Optional[ShopifyRepository] = None,
        product_repo: Optional[ProductRepository] = None,
        client: Optional[ShopifyClient] = None,
    ):
        self.tenant_id = tenant_id
        self.shopify_repo = shopify_repo or ShopifyRepository()
        self.product_repo = product_repo or ProductRepository()
        self.client = client

    async def _ensure_client(self) -> ShopifyClient:
        if self.client:
            return self.client
        creds = await self.shopify_repo.get_credentials(self.tenant_id)
        if not creds:
            from app.features.emails.services.email_dispatcher import email_dispatcher
            await email_dispatcher.publish_email_event(
                event_name="EXTERNAL_CREDENTIAL_ERROR",
                recipient_email=f"admin@{self.tenant_id}.com",
                tenant_id=self.tenant_id,
                data={
                    "platform": "Shopify",
                    "error_detail": f"Credenciais do Shopify não configuradas para o Tenant '{self.tenant_id}'.",
                },
            )
            raise HTTPException(
                status_code=status.HTTP_412_PRECONDITION_FAILED,
                detail=f"Credenciais do Shopify não configuradas para o Tenant '{self.tenant_id}'.",
            )
        self.client = ShopifyClient(
            shop_domain=creds.shop_domain,
            access_token=creds.access_token,
            api_version=settings.SHOPIFY_API_VERSION,
        )
        return self.client

    async def sync_product(self, product_data: dict) -> dict:
        client = await self._ensure_client()
        sku = product_data.get("sku", "")

        try:
            # Verifica se já existe produto no banco de dados com shopify_product_id para este SKU
            existing_product = await self.product_repo.get_by_tenant_and_sku(self.tenant_id, sku) if sku else None
            
            if existing_product and existing_product.shopify_product_id:
                # Atualização se o produto já existir no Shopify
                result = await client.update_product(
                    product_id=existing_product.shopify_product_id,
                    update_fields=product_data,
                )
                shopify_id = existing_product.shopify_product_id
            else:
                # Criação nova no Shopify via GraphQL
                result = await client.sync_product(product_data)
                shopify_id = result.get("product", {}).get("id")

            # Mapeamento explícito de chave estrangeira no banco de dados
            if sku and shopify_id:
                await self.product_repo.update_external_ids(
                    tenant_id=self.tenant_id,
                    sku=sku,
                    shopify_product_id=shopify_id,
                )

            return result

        except ValueError as val_err:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(val_err),
            )
        except Exception as e:
            try:
                error_msg = str(e)
                input_data = ShopifyProductSetInput.from_internal_data(product_data)
                CsvExportService.generate_shopify_csv([input_data])
                download_url = "/api/v1/export?platform=shopify"

                return JSONResponse(
                    status_code=status.HTTP_202_ACCEPTED,
                    content={
                        "status": "fallback_csv",
                        "message": "A sincronização direta falhou. O download do CSV com copywriting IA foi gerado como alternativa.",
                        "reason": error_msg,
                        "error_detail": f"Falha de sincronização GraphQL Shopify: {error_msg}",
                        "download_url": download_url,
                    },
                )
            except Exception as fallback_err:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Falha na execução da mutação no provedor Shopify: {str(e)} | Erro no Fallback de CSV: {str(fallback_err)}",
                )

    async def add_media_to_product(self, product_id: str, media_payload: ShopifyMediaAddRequest) -> dict:
        client = await self._ensure_client()
        urls = media_payload.image_urls
        alt = media_payload.alt_text
        if not urls:
            raise HTTPException(status_code=400, detail="A lista 'image_urls' não pode estar vazia.")

        try:
            return await client.create_product_media(product_id=product_id, image_urls=urls, alt_text=alt)
        except ValueError as val_err:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(val_err))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    async def update_product(self, product_id: str, update_payload: dict) -> dict:
        client = await self._ensure_client()
        try:
            new_images = update_payload.pop("new_images", None)
            return await client.update_product(
                product_id=product_id,
                update_fields=update_payload,
                new_images=new_images,
            )
        except ValueError as val_err:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(val_err))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Erro update Shopify: {str(e)}")

    async def delete_product(self, product_id: str) -> None:
        client = await self._ensure_client()
        try:
            await client.delete_product(product_id=product_id)
            return None
        except ValueError as val_err:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Erro exclusão Shopify: {str(e)}")

    async def list_products(self, first: int = 10, after: Optional[str] = None) -> dict:
        client = await self._ensure_client()
        try:
            return await client.list_products(first=first, after=after)
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Erro listagem Shopify: {str(e)}")

    async def register_app_webhooks(self, shop_domain: str, access_token: str) -> dict:
        """
        Cadastra automaticamente as inscrições de Webhooks GraphQL no Shopify para a loja recém-autenticada.
        """
        import httpx

        client = ShopifyClient(
            shop_domain=shop_domain,
            access_token=access_token,
            api_version=settings.SHOPIFY_API_VERSION,
        )

        topics = [
            "PRODUCTS_CREATE",
            "PRODUCTS_UPDATE",
            "PRODUCTS_DELETE",
            "INVENTORY_LEVELS_UPDATE",
            "BULK_OPERATIONS_FINISH",
            "APP_UNINSTALLED",
        ]

        redirect_uri = getattr(settings, "SHOPIFY_REDIRECT_URI", "")
        if redirect_uri and "/shopify/" in redirect_uri:
            base_api_url = redirect_uri.rsplit("/shopify/", 1)[0]
            webhook_uri = f"{base_api_url}/shopify/webhooks"
        elif redirect_uri:
            webhook_uri = redirect_uri.replace("/auth/callback", "/webhooks")
        else:
            webhook_uri = "https://api.ecommercebot.com/api/v1/shopify/webhooks"

        mutation_query = """
        mutation RegisterWebhook($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
          webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
            webhookSubscription {
              id
              topic
              uri
            }
            userErrors {
              field
              message
            }
          }
        }
        """

        results = {}
        for topic in topics:
            payload = {
                "query": mutation_query,
                "variables": {
                    "topic": topic,
                    "webhookSubscription": {
                        "format": "JSON",
                        "uri": webhook_uri,
                    },
                },
            }
            try:
                async with httpx.AsyncClient(timeout=10.0) as http_client:
                    res = await http_client.post(client.base_url, headers=client.headers, json=payload)
                    res.raise_for_status()
                    res_json = res.json()

                    user_errors = res_json.get("data", {}).get("webhookSubscriptionCreate", {}).get("userErrors", [])
                    if user_errors:
                        logger.warning(f"[Shopify Webhook Registration] UserErrors no tópico '{topic}': {user_errors}")
                    else:
                        logger.info(f"[Shopify Webhook Registration] Tópico '{topic}' cadastrado com sucesso para '{shop_domain}'.")
                    results[topic] = res_json
            except Exception as err:
                logger.error(f"[Shopify Webhook Registration] Falha ao registrar webhook para tópico '{topic}': {err}")
                results[topic] = {"error": str(err)}

        return results

