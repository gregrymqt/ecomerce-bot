from typing import List, Optional

from app.features.products.repositories.product_repository import ProductRepository
from app.features.shopify.infrastructure.client import ShopifyClient
from app.features.shopify.repositories import ShopifyRepository
from app.features.shopify.schemas import ShopifyMediaAddRequest
from app.features.shopify.services.shopify_bulk_service import ShopifyBulkService
from app.features.shopify.services.shopify_inventory_service import ShopifyInventoryService
from app.features.shopify.services.shopify_product_service import ShopifyProductService


class ShopifyService:
    """
    Fachada composite de Lógica de Negócio para o Shopify.
    Delega as operações para os serviços especializados de subdomínio:
      - ShopifyProductService (Catálogo, Mídias, Status, Remoções, Fallbacks)
      - ShopifyInventoryService (Ajuste de Estoque por SKU)
      - ShopifyBulkService (Bulk API, Staged Uploads, JSONL, Webhook Finish)
    Garante 100% de retrocompatibilidade com chamadas existentes no ecossistema.
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

        self.product_service = ShopifyProductService(
            tenant_id=tenant_id,
            shopify_repo=self.shopify_repo,
            product_repo=self.product_repo,
            client=self.client,
        )
        self.inventory_service = ShopifyInventoryService(
            tenant_id=tenant_id,
            shopify_repo=self.shopify_repo,
            product_repo=self.product_repo,
            client=self.client,
        )
        self.bulk_service = ShopifyBulkService(
            tenant_id=tenant_id,
            shopify_repo=self.shopify_repo,
            product_repo=self.product_repo,
            client=self.client,
        )

    # Delegadores de Produtos e Mídias
    async def sync_product(self, product_data: dict) -> dict:
        return await self.product_service.sync_product(product_data)

    async def add_media_to_product(self, product_id: str, media_payload: ShopifyMediaAddRequest) -> dict:
        return await self.product_service.add_media_to_product(product_id, media_payload)

    async def update_product(self, product_id: str, update_payload: dict) -> dict:
        return await self.product_service.update_product(product_id, update_payload)

    async def delete_product(self, product_id: str) -> None:
        return await self.product_service.delete_product(product_id)

    async def list_products(self, first: int = 10, after: Optional[str] = None) -> dict:
        return await self.product_service.list_products(first=first, after=after)

    async def delete_remote_product_by_sku(self, sku: str) -> dict:
        return await self.product_service.delete_remote_product_by_sku(sku)

    async def change_product_status_by_sku(self, sku: str, status_value: str) -> dict:
        return await self.product_service.change_product_status_by_sku(sku, status_value)

    async def register_app_webhooks(self, shop_domain: str, access_token: str) -> dict:
        return await self.product_service.register_app_webhooks(shop_domain, access_token)

    # Delegadores de Estoque
    async def update_inventory_by_sku(
        self,
        sku: str,
        quantity: int,
        inventory_item_id: Optional[str] = None,
        location_id: Optional[str] = None,
    ) -> dict:
        return await self.inventory_service.update_inventory_by_sku(
            sku=sku,
            quantity=quantity,
            inventory_item_id=inventory_item_id,
            location_id=location_id,
        )

    # Delegadores de Operações em Lote (Bulk API)
    async def sync_bulk_catalog(self, skus: List[str]) -> dict:
        return await self.bulk_service.sync_bulk_catalog(skus)

    async def process_bulk_operation_finish(self, payload: dict) -> dict:
        return await self.bulk_service.process_bulk_operation_finish(payload)
