import json
import logging
from typing import List, Optional
import httpx
from fastapi import HTTPException, status

from app.core.config.settings import settings
from app.features.products.repositories.product_repository import ProductRepository
from app.features.shopify.infrastructure.client import ShopifyClient
from app.features.shopify.repositories import ShopifyRepository
from app.features.shopify.schemas import ShopifyProductSetInput

logger = logging.getLogger(__name__)


class ShopifyBulkService:
    """
    Serviço de aplicação para orquestração de operações assíncronas em massa (Bulk Operations) no Shopify.
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

    async def sync_bulk_catalog(self, skus: List[str]) -> dict:
        client = await self._ensure_client()
        products = await self.product_repo.get_by_tenant_and_skus(self.tenant_id, skus)
        if not products:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Nenhum produto encontrado no banco local para os SKUs fornecidos no tenant '{self.tenant_id}'.",
            )

        jsonl_lines = []
        for p in products:
            raw_data = p.raw_payload if isinstance(p.raw_payload, dict) else {}
            raw_data["tenant_id"] = self.tenant_id
            raw_data["sku"] = p.sku
            raw_data["title"] = p.title or raw_data.get("title", "")

            input_data = ShopifyProductSetInput.from_internal_data(raw_data)
            jsonl_lines.append(json.dumps({"input": input_data.model_dump(exclude_none=True)}))

        jsonl_content = "\n".join(jsonl_lines)

        staged_upload_res = await client.create_staged_upload([
            {
                "filename": "bulk_products.jsonl",
                "mimeType": "text/jsonl",
                "resource": "BULK_MUTATION_VARIABLES",
                "httpMethod": "POST",
            }
        ])

        staged_targets = staged_upload_res.get("stagedTargets", [])
        if not staged_targets:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Falha ao obter URL pré-assinada da CDN do Shopify.",
            )

        staged_target = staged_targets[0]
        upload_url = staged_target.get("url")
        parameters = staged_target.get("parameters", [])

        staged_upload_path = None
        form_data = {}
        for param in parameters:
            name = param.get("name") if isinstance(param, dict) else getattr(param, "name", None)
            val = param.get("value") if isinstance(param, dict) else getattr(param, "value", None)
            if name and val:
                form_data[name] = val
                if name == "key":
                    staged_upload_path = val

        if not staged_upload_path:
            staged_upload_path = form_data.get("key", "bulk_products.jsonl")

        files = {"file": ("bulk_products.jsonl", jsonl_content.encode("utf-8"), "text/jsonl")}
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            upload_res = await http_client.post(upload_url, data=form_data, files=files)
            if upload_res.status_code not in (200, 201, 204):
                logger.error(f"[ShopifyBulkService] Falha no upload para CDN do Shopify ({upload_res.status_code}): {upload_res.text}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Erro no upload do arquivo JSONL para CDN do Shopify: {upload_res.status_code}",
                )

        mutation_query = """
        mutation productSet($input: ProductSetInput!) {
          productSet(input: $input) {
            product {
              id
              title
            }
            userErrors {
              field
              message
            }
          }
        }
        """

        bulk_run_res = await client.run_bulk_mutation(
            staged_upload_path=staged_upload_path,
            mutation_query=mutation_query,
        )

        bulk_op = bulk_run_res.get("bulkOperation", {})

        for p in products:
            await self.product_repo.set_status(tenant_id=self.tenant_id, sku=p.sku, status="PROCESSING")

        return {
            "status": "accepted",
            "message": "Operação em lote iniciada com sucesso na Shopify.",
            "bulk_operation": bulk_op,
            "processed_skus_count": len(products),
        }

    async def process_bulk_operation_finish(self, payload: dict) -> dict:
        bulk_url = payload.get("url")
        if not bulk_url and isinstance(payload.get("admin_graphql_api_id"), dict):
            bulk_url = payload.get("admin_graphql_api_id", {}).get("url")

        logger.info(f"[ShopifyBulkService] Processando encerramento de Bulk Operation. URL de resultado: '{bulk_url}'")

        if not bulk_url:
            logger.warning("[ShopifyBulkService] Webhook BULK_OPERATIONS_FINISH sem URL de resultado retornado.")
            return {"status": "ignored", "reason": "No result URL in payload"}

        async with httpx.AsyncClient(timeout=60.0) as http_client:
            res = await http_client.get(bulk_url)
            if res.status_code != 200:
                logger.error(f"[ShopifyBulkService] Falha ao baixar resultado JSONL da Shopify: {res.status_code}")
                return {"status": "error", "message": f"HTTP {res.status_code} downloading result file"}
            jsonl_text = res.text

        success_count = 0
        error_count = 0

        for line in jsonl_text.strip().split("\n"):
            if not line.strip():
                continue
            try:
                item = json.loads(line)
                product_data = item.get("data", {}).get("productSet", {}).get("product", {})
                user_errors = item.get("data", {}).get("productSet", {}).get("userErrors", [])

                shopify_id = product_data.get("id") if product_data else None

                if shopify_id:
                    sku = item.get("sku")
                    if not sku and item.get("input"):
                        variants = item.get("input", {}).get("variants", [])
                        if variants:
                            sku = variants[0].get("sku")

                    if sku:
                        await self.product_repo.update_external_ids(
                            tenant_id=self.tenant_id,
                            sku=sku,
                            shopify_product_id=shopify_id,
                        )
                    success_count += 1
                elif user_errors:
                    error_count += 1
                    logger.warning(f"[ShopifyBulkService] Erro em linha do Bulk Operation: {user_errors}")
            except Exception as err:
                logger.error(f"[ShopifyBulkService] Falha no parse de linha JSONL de resultado: {err}")

        logger.info(f"[ShopifyBulkService] Concluído processamento de Bulk Operation (Sucesso: {success_count}, Falhas: {error_count}).")
        return {"status": "completed", "success_count": success_count, "error_count": error_count}
