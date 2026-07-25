import math
from typing import Optional
from fastapi import HTTPException, status

from app.features.products.repositories.product_repository import ProductRepository
from app.features.products.schemas import (
    Product, 
    ProductUpdateSchema, 
    PaginatedProductsResponse
)

class ProductService:
    def __init__(self, repo: Optional[ProductRepository] = None):
        self.repo = repo or ProductRepository()

    async def list_catalog_products(
        self,
        tenant_id: str,
        status_filter: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 20
    ) -> PaginatedProductsResponse:
        models, total = await self.repo.list_products(
            tenant_id=tenant_id,
            status=status_filter,
            search=search,
            page=page,
            limit=limit
        )

        items = []
        for m in models:
            payload = dict(m.raw_payload or {})
            payload["sku"] = m.sku
            payload["title"] = m.title
            payload["status"] = m.status
            payload["tenant_id"] = m.tenant_id
            items.append(Product(**payload))

        pages = math.ceil(total / limit) if limit > 0 else 1

        return PaginatedProductsResponse(
            items=items,
            total=total,
            page=page,
            limit=limit,
            pages=pages
        )

    async def update_product_details(
        self,
        tenant_id: str,
        sku: str,
        data: ProductUpdateSchema
    ) -> Product:
        update_dict = data.model_dump(exclude_unset=True)
        if "status" in update_dict and update_dict["status"]:
            update_dict["status"] = update_dict["status"].value

        updated_model = await self.repo.update_product_data(tenant_id, sku, update_dict)
        if not updated_model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Produto com SKU '{sku}' não encontrado."
            )

        payload = dict(updated_model.raw_payload or {})
        return Product(**payload)

    async def delete_product(self, tenant_id: str, sku: str) -> dict:
        deleted = await self.repo.delete_product(tenant_id, sku)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Produto com SKU '{sku}' não encontrado."
            )
        return {"status": "success", "message": f"Produto '{sku}' removido com sucesso."}