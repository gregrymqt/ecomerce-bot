import json
import logging
from typing import List, Optional
import httpx
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

    async def update_inventory_by_sku(
        self,
        sku: str,
        quantity: int,
        inventory_item_id: Optional[str] = None,
        location_id: Optional[str] = None,
    ) -> dict:
        """
        Localiza o produto no PostgreSQL por (tenant_id, sku), resolve os GIDs de inventário/localização e
        executa a mutação otimizada set_inventory_quantity.
        """
        client = await self._ensure_client()
        product = await self.product_repo.get_by_tenant_and_sku(self.tenant_id, sku)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Produto SKU '{sku}' não encontrado para o tenant '{self.tenant_id}'.",
            )

        # Resolvendo inventory_item_id do payload bruto se não fornecido
        if not inventory_item_id and product.raw_payload:
            variants = product.raw_payload.get("variants", [])
            if variants:
                inventory_item_id = variants[0].get("inventory_item_id") or variants[0].get("inventoryItem", {}).get("id")

        if not inventory_item_id:
            inventory_item_id = f"gid://shopify/InventoryItem/{sku}"

        # Resolvendo location_id da loja se não fornecido
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

        # Atualizando timestamp de sincronização no banco local
        if product.shopify_product_id:
            await self.product_repo.update_external_ids(
                tenant_id=self.tenant_id,
                sku=sku,
                shopify_product_id=product.shopify_product_id,
            )

        return result

    async def delete_remote_product_by_sku(self, sku: str) -> dict:
        """
        Localiza o produto no PostgreSQL por (tenant_id, sku), executa productDelete na Shopify e desvincula o shopify_product_id.
        """
        client = await self._ensure_client()
        product = await self.product_repo.get_by_tenant_and_sku(self.tenant_id, sku)
        if not product or not product.shopify_product_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Produto SKU '{sku}' com vínculo Shopify não encontrado para o tenant '{self.tenant_id}'.",
            )

        deleted_id = await client.delete_product(product_id=product.shopify_product_id)

        # Desvinculando shopify_product_id no banco de dados local
        await self.product_repo.unlink_shopify_product(
            tenant_id=self.tenant_id,
            shopify_product_id=product.shopify_product_id,
        )

        return {"status": "success", "deleted_product_id": deleted_id or product.shopify_product_id, "sku": sku}

    async def change_product_status_by_sku(self, sku: str, status_value: str) -> dict:
        """
        Executa update_product_status na Shopify e reflete a alteração na base de dados local.
        """
        client = await self._ensure_client()
        product = await self.product_repo.get_by_tenant_and_sku(self.tenant_id, sku)
        if not product or not product.shopify_product_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Produto SKU '{sku}' com vínculo Shopify não encontrado para o tenant '{self.tenant_id}'.",
            )

        result = await client.update_product_status(
            product_id=product.shopify_product_id,
            status=status_value,
        )

        # Atualizando no banco local
        await self.product_repo.update_external_ids(
            tenant_id=self.tenant_id,
            sku=sku,
            shopify_product_id=product.shopify_product_id,
        )

        return result

    async def sync_bulk_catalog(self, skus: List[str]) -> dict:
        """
        Orquestra a sincronização em massa de catálogos via Bulk Operations & Staged Uploads.
        1. Busca produtos por tenant_id e lista de skus no PostgreSQL.
        2. Gera payload formatado em JSONL (.jsonl).
        3. Chama create_staged_upload para obter a URL pré-assinada na CDN do Shopify.
        4. Realiza POST assíncrono contendo o arquivo .jsonl via httpx.AsyncClient.
        5. Aciona run_bulk_mutation com a mutação productSet.
        6. Atualiza o status local dos produtos para PROCESSING.
        """
        client = await self._ensure_client()
        products = await self.product_repo.get_by_tenant_and_skus(self.tenant_id, skus)
        if not products:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Nenhum produto encontrado no banco local para os SKUs fornecidos no tenant '{self.tenant_id}'.",
            )

        # 1. Gerar linhas do arquivo JSONL contendo as variáveis de cada produto
        jsonl_lines = []
        for p in products:
            raw_data = p.raw_payload if isinstance(p.raw_payload, dict) else {}
            raw_data["tenant_id"] = self.tenant_id
            raw_data["sku"] = p.sku
            raw_data["title"] = p.title or raw_data.get("title", "")

            input_data = ShopifyProductSetInput.from_internal_data(raw_data)
            jsonl_lines.append(json.dumps({"input": input_data.model_dump(exclude_none=True)}))

        jsonl_content = "\n".join(jsonl_lines)

        # 2. Obter URL pré-assinada (Staged Upload)
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

        # Extrair a chave/caminho do upload no estágio
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

        # 3. Upload assíncrono via httpx.AsyncClient
        files = {"file": ("bulk_products.jsonl", jsonl_content.encode("utf-8"), "text/jsonl")}
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            upload_res = await http_client.post(upload_url, data=form_data, files=files)
            if upload_res.status_code not in (200, 201, 204):
                logger.error(f"[ShopifyService] Falha no upload para CDN do Shopify ({upload_res.status_code}): {upload_res.text}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Erro no upload do arquivo JSONL para CDN do Shopify: {upload_res.status_code}",
                )

        # 4. Executar a mutação bulkOperationRunMutation
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

        # 5. Atualizar status dos produtos para PROCESSING na base local
        for p in products:
            await self.product_repo.set_status(tenant_id=self.tenant_id, sku=p.sku, status="PROCESSING")

        return {
            "status": "accepted",
            "message": "Operação em lote iniciada com sucesso na Shopify.",
            "bulk_operation": bulk_op,
            "processed_skus_count": len(products),
        }

    async def process_bulk_operation_finish(self, payload: dict) -> dict:
        """
        Handler para processar o encerramento da Bulk Operation via webhook BULK_OPERATIONS_FINISH.
        Baixa o resultado em JSONL, realiza o parse e atualiza os produtos no PostgreSQL local.
        """
        bulk_url = payload.get("url")
        if not bulk_url and isinstance(payload.get("admin_graphql_api_id"), dict):
            bulk_url = payload.get("admin_graphql_api_id", {}).get("url")

        logger.info(f"[ShopifyService] Processando encerramento de Bulk Operation. URL de resultado: '{bulk_url}'")

        if not bulk_url:
            logger.warning("[ShopifyService] Webhook BULK_OPERATIONS_FINISH sem URL de resultado retornado.")
            return {"status": "ignored", "reason": "No result URL in payload"}

        # Download assíncrono do arquivo de resultado JSONL
        async with httpx.AsyncClient(timeout=60.0) as http_client:
            res = await http_client.get(bulk_url)
            if res.status_code != 200:
                logger.error(f"[ShopifyService] Falha ao baixar resultado JSONL da Shopify: {res.status_code}")
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
                    # Se SKU ou dados do produto retornados
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
                    logger.warning(f"[ShopifyService] Erro em linha do Bulk Operation: {user_errors}")
            except Exception as err:
                logger.error(f"[ShopifyService] Falha no parse de linha JSONL de resultado: {err}")

        logger.info(f"[ShopifyService] Concluído processamento de Bulk Operation (Sucesso: {success_count}, Falhas: {error_count}).")
        return {"status": "completed", "success_count": success_count, "error_count": error_count}



