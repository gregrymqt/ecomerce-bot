import logging
from typing import Optional
from fastapi import HTTPException, status

from app.core.config.settings import settings
from app.features.products.repositories.product_repository import ProductRepository
from app.features.shopify.infrastructure.client import ShopifyClient
from app.features.shopify.repositories import ShopifyRepository

logger = logging.getLogger(__name__)


class ShopifyInventoryService:
    """
    Serviço de aplicação para gestão e atualização de Estoque/Inventário no Shopify.
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

    async def update_inventory_by_sku(
        self,
        sku: str,
        quantity: int,
        inventory_item_id: Optional[str] = None,
        location_id: Optional[str] = None,
    ) -> dict:
        client = await self._ensure_client()
        product = await self.product_repo.get_by_tenant_and_sku(self.tenant_id, sku)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Produto SKU '{sku}' não encontrado para o tenant '{self.tenant_id}'.",
            )

        if not inventory_item_id and product.raw_payload:
            variants = product.raw_payload.get("variants", [])
            if variants:
                inventory_item_id = variants[0].get("inventory_item_id") or variants[0].get("inventoryItem", {}).get("id")

        if not inventory_item_id:
            inventory_item_id = f"gid://shopify/InventoryItem/{sku}"

        if not location_id:
            location_id = await client.get_primary_location_id()

        if not location_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Não foi possível identificar o location_id da loja Shopify para atualização de estoque.",
            )

        result = await client.set_inventory_quantity(
            inventory_item_id=str(inventory_item_id),
            location_id=str(location_id),
            quantity=quantity,
        )

        if product.shopify_product_id:
            await self.product_repo.update_external_ids(
                tenant_id=self.tenant_id,
                sku=sku,
                shopify_product_id=product.shopify_product_id,
            )

        return result
