from typing import Dict, List, Optional, Any, Union
import logging
from fastapi import HTTPException, status
from fastapi.responses import JSONResponse

from app.core.shared.csv_exporter import CsvExportService
from app.features.nuvemshop.infrastructure.client import NuvemshopClient
from app.features.nuvemshop.repositories import NuvemshopRepository
from app.features.products.repositories.product_repository import ProductRepository
from app.features.products.domain.models import ProductModel
from app.features.nuvemshop.schemas import NuvemshopProductRequest, NuvemshopBulkSyncResponse

logger = logging.getLogger(__name__)


class NuvemshopService:
    """
    Serviço de Lógica de Negócio para a Nuvemshop.
    Consome o NuvemshopRepository (para credenciais) e o NuvemshopClient (para a API REST).
    """

    def __init__(
        self,
        tenant_id: str,
        nuvemshop_repo: Optional[NuvemshopRepository] = None,
        product_repo: Optional[ProductRepository] = None,
        client: Optional[NuvemshopClient] = None,
    ):
        self.tenant_id = tenant_id
        self.nuvemshop_repo = nuvemshop_repo or NuvemshopRepository()
        self.product_repo = product_repo or ProductRepository()
        self.client = client

    async def _ensure_client(self) -> NuvemshopClient:
        if self.client:
            return self.client
        creds = await self.nuvemshop_repo.get_credentials(self.tenant_id)
        if not creds:
            from app.features.emails.services.email_dispatcher import email_dispatcher
            await email_dispatcher.publish_email_event(
                event_name="EXTERNAL_CREDENTIAL_ERROR",
                recipient_email=f"admin@{self.tenant_id}.com",
                tenant_id=self.tenant_id,
                data={
                    "platform": "Nuvemshop",
                    "error_detail": f"Credenciais da Nuvemshop não configuradas para o Tenant '{self.tenant_id}'.",
                },
            )
            raise HTTPException(
                status_code=status.HTTP_412_PRECONDITION_FAILED,
                detail=f"Credenciais da Nuvemshop não configuradas ou ausentes para o Tenant '{self.tenant_id}'.",
            )
        client = NuvemshopClient(store_id=creds.store_id, access_token=creds.access_token, app_email=creds.app_email)

        is_valid_scope = await client.validate_scopes()
        if not is_valid_scope:
            from app.features.emails.services.email_dispatcher import email_dispatcher
            await email_dispatcher.publish_email_event(
                event_name="EXTERNAL_CREDENTIAL_ERROR",
                recipient_email=f"admin@{self.tenant_id}.com",
                tenant_id=self.tenant_id,
                data={
                    "platform": "Nuvemshop",
                    "error_detail": "O token fornecido não possui permissões de escrita (write_products) na Nuvemshop.",
                },
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="O token fornecido não possui permissões de escrita (write_products) na Nuvemshop.",
            )

        self.client = client
        return self.client

    async def create_product(self, product: NuvemshopProductRequest) -> Union[Dict[str, Any], JSONResponse]:
        client = await self._ensure_client()
        sku = product.variants[0].sku if product.variants and len(product.variants) > 0 else None

        try:
            # Verifica se já existe mapeamento no banco de dados para este SKU
            existing_product = await self.product_repo.get_by_tenant_and_sku(self.tenant_id, sku) if sku else None

            if existing_product and existing_product.nuvemshop_product_id:
                # Atualiza metadados do produto existente na Nuvemshop
                product_id_int = int(existing_product.nuvemshop_product_id)
                update_payload = product.model_dump(by_alias=True, exclude_none=True)
                result = await client.update_product_metadata(product_id_int, update_payload)
                nuvemshop_id = existing_product.nuvemshop_product_id
            else:
                # Cria produto novo na Nuvemshop via REST API
                result = await client.create_product(product)
                nuvemshop_id = result.get("id")

            # Mapeamento explícito de chave estrangeira no banco de dados
            if sku and nuvemshop_id:
                await self.product_repo.update_external_ids(
                    tenant_id=self.tenant_id,
                    sku=sku,
                    nuvemshop_product_id=str(nuvemshop_id),
                )

            return result
        except Exception as e:
            try:
                error_msg = str(e)
                CsvExportService.generate_nuvemshop_csv([product])
                download_url = "/api/v1/export?platform=nuvemshop"

                return JSONResponse(
                    status_code=status.HTTP_202_ACCEPTED,
                    content={
                        "status": "fallback_csv",
                        "message": "A sincronização direta falhou. O download do CSV com copywriting IA foi gerado como alternativa.",
                        "reason": error_msg,
                        "error_detail": f"Falha de comunicação Nuvemshop: {error_msg}",
                        "download_url": download_url,
                    },
                )
            except Exception as fallback_err:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Falha de comunicação com o provedor Nuvemshop: {str(e)} | Erro no Fallback: {str(fallback_err)}",
                )

    async def get_product_by_id(self, product_id: int) -> Dict[str, Any]:
        client = await self._ensure_client()
        try:
            return await client.get_product_by_id(product_id)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Produto com o ID {product_id} não foi encontrado na Nuvemshop.",
            )

    async def get_product_by_sku(self, sku: str) -> Dict[str, Any]:
        client = await self._ensure_client()
        product = await client.get_product_by_sku(sku)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Nenhum produto correspondente ao SKU '{sku}' foi encontrado.",
            )
        return product

    async def update_product_metadata(self, product_id: int, update_data: Dict[str, Any]) -> Dict[str, Any]:
        client = await self._ensure_client()
        try:
            return await client.update_product_metadata(product_id, update_data)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Incapaz de atualizar o produto {product_id}. Verifique o payload. Erro: {str(e)}",
            )

    async def update_stock_price_batch(self, batch_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        client = await self._ensure_client()
        try:
            return await client.update_stock_price_batch(batch_data)
        except ValueError as val_err:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(val_err))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    async def delete_product(self, product_id: int) -> None:
        client = await self._ensure_client()
        try:
            await client.delete_product(product_id)
            return None
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Erro ao tentar remover o produto {product_id}.",
            )

    async def enqueue_bulk_sync(
        self,
        skus: List[str],
        force_update: bool = False,
        visibility: str = "visible",
    ) -> NuvemshopBulkSyncResponse:
        """
        Valida credenciais do tenant e enfileira mensagens de sincronização para a fila RabbitMQ 'nuvemshop_bulk_sync'.
        Retorna HTTP 202 com o job_id UUID v4.
        """
        import uuid
        import json
        import aio_pika
        from app.core.config.rabbitmq import get_rabbitmq_connection
        from app.features.nuvemshop.schemas.product_sync import (
            NuvemshopBulkSyncMessage,
            NuvemshopBulkSyncResponse,
        )

        # 1. Valida credenciais ativas do tenant antes de aceitar o lote
        await self._ensure_client()

        # 2. Gera UUID v4 do lote
        job_id = str(uuid.uuid4())

        # 3. Publica cada SKU como uma mensagem independente na fila RabbitMQ
        connection = await get_rabbitmq_connection()
        async with connection:
            channel = await connection.channel()

            for sku in skus:
                msg_payload = NuvemshopBulkSyncMessage(
                    job_id=job_id,
                    tenant_id=self.tenant_id,
                    sku=sku,
                    force_update=force_update,
                    visibility=visibility,
                )
                await channel.default_exchange.publish(
                    aio_pika.Message(
                        body=json.dumps(msg_payload.model_dump()).encode("utf-8"),
                        content_type="application/json",
                        delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                    ),
                    routing_key="nuvemshop_bulk_sync",
                )

        logger.info(
            f"🚀 [NuvemshopService] Job '{job_id}' enfileirado com sucesso: {len(skus)} SKUs para o tenant '{self.tenant_id}'."
        )

        return NuvemshopBulkSyncResponse(
            job_id=job_id,
            total_enqueued=len(skus),
            status="queued",
            message=f"{len(skus)} produto(s) enfileirado(s) com sucesso para sincronização em lote na Nuvemshop.",
        )

    def build_nuvemshop_payload(
        self,
        product: ProductModel,
        visibility: str = "visible",
        is_update: bool = False,
        category_ids: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """
        Mapeia os dados internos do ProductModel para a estrutura oficial da REST API da Nuvemshop.
        Respeita as regras de multilingualismo dict {"pt": "..."}, limite de 9 imagens e isolamento de visibility.
        """
        raw_data = getattr(product, "raw_payload", {}) or {}
        ai_data = getattr(product, "ai_enriched_data", {}) or {}

        # Título e Descrição (Prioridade para IA Enriched)
        title = ai_data.get("title") or getattr(product, "title", None) or raw_data.get("title", "")
        description_raw = ai_data.get("description") or ai_data.get("seo_description") or raw_data.get("description", "")
        description_html = f"<p>{description_raw}</p>" if description_raw and not str(description_raw).strip().startswith("<") else description_raw

        # 1. Campos Multilíngues (OBRIGATÓRIO: dict {"pt": "..."})
        name_dict: Dict[str, str] = {"pt": str(title)}
        desc_dict: Dict[str, str] = {"pt": str(description_html)}

        # 2. Visibilidade (CRÍTICO: Apenas 'visibility', NUNCA enviar 'published')
        clean_visibility = visibility if visibility in ("visible", "unlisted", "hidden") else "visible"

        # 3. Galeria de Imagens (Limite máximo de 9 imagens na carga inicial)
        raw_images = ai_data.get("images") or raw_data.get("images") or []
        image_urls: List[str] = []
        if isinstance(raw_images, list):
            for img in raw_images:
                if isinstance(img, str) and img.startswith("http"):
                    image_urls.append(img)
                elif isinstance(img, dict) and img.get("src"):
                    image_urls.append(str(img.get("src")))

        images_payload = [{"src": url} for url in image_urls[:9]] if image_urls else None

        # 4. Estrutura de Variantes
        variants_raw = raw_data.get("variants", [])
        variants_payload: List[Dict[str, Any]] = []

        if isinstance(variants_raw, list) and len(variants_raw) > 0:
            for var in variants_raw:
                if isinstance(var, dict):
                    v_price = var.get("price") or raw_data.get("price", 0.0)
                    v_promo = var.get("promotional_price") or var.get("compare_at_price")
                    v_stock = var.get("stock") or raw_data.get("stock", 0)
                    v_sku = var.get("sku") or getattr(product, "sku", "")
                    v_weight = var.get("weight")
                    v_cost = var.get("cost")

                    v_payload: Dict[str, Any] = {
                        "price": float(v_price) if v_price is not None else 0.0,
                        "stock": int(v_stock) if v_stock is not None else 0,
                        "stock_management": True,
                        "sku": str(v_sku) if v_sku else getattr(product, "sku", ""),
                    }
                    if v_promo is not None:
                        v_payload["promotional_price"] = float(v_promo)
                    if v_weight is not None:
                        v_payload["weight"] = float(v_weight)
                    if v_cost is not None:
                        v_payload["cost"] = float(v_cost)
                    variants_payload.append(v_payload)

        if not variants_payload:
            price = raw_data.get("price", 0.0)
            stock = raw_data.get("stock", 0)
            variants_payload.append({
                "price": float(price) if price else 0.0,
                "stock": int(stock) if stock else 0,
                "stock_management": True,
                "sku": getattr(product, "sku", ""),
            })

        # Assemble Payload
        payload: Dict[str, Any] = {
            "name": name_dict,
            "description": desc_dict,
            "visibility": clean_visibility,
            "variants": variants_payload,
        }

        if images_payload:
            payload["images"] = images_payload

        # Tags
        tags = ai_data.get("tags") or raw_data.get("tags")
        if tags:
            payload["tags"] = ",".join(tags) if isinstance(tags, list) else str(tags)

        # SEO Title / Description
        seo_title = ai_data.get("seo_title") or raw_data.get("seo_title")
        if seo_title:
            payload["seo_title"] = {"pt": str(seo_title)}

        seo_desc = ai_data.get("seo_description") or raw_data.get("seo_description")
        if seo_desc:
            payload["seo_description"] = {"pt": str(seo_desc)}

        # 5. Atualização Parcial de Categorias (PUT): Omitir chave se for update sem alteração
        if category_ids is not None and len(category_ids) > 0:
            payload["categories"] = category_ids
        else:
            categories = raw_data.get("categories")
            if categories and isinstance(categories, list):
                payload["categories"] = [int(c) for c in categories if isinstance(c, (int, str)) and str(c).isdigit()]
            elif not is_update and categories is not None:
                payload["categories"] = []

        return payload

    async def sync_single_product_sku(
        self,
        sku: str,
        force_update: bool = False,
        visibility: str = "visible",
    ) -> Dict[str, Any]:
        """
        Executa o upsert de um único produto no PostgreSQL para a Nuvemshop.
        Utilizado pelo NuvemshopSyncWorker.
        """
        client = await self._ensure_client()
        product = await self.product_repo.get_by_tenant_and_sku(self.tenant_id, sku)

        if not product:
            raise ValueError(f"Produto com SKU '{sku}' não foi encontrado no banco de dados para tenant '{self.tenant_id}'.")

        # 0. Resolução/Mapeamento De-Para ou Criação On-Demand de Categoria
        resolved_category_id: Optional[int] = None
        try:
            ai_data = getattr(product, "ai_enriched_data", {}) or {}
            raw_data = getattr(product, "raw_payload", {}) or {}
            raw_cat_name = ai_data.get("category") or raw_data.get("category") or getattr(product, "category", None)
            if raw_cat_name:
                from app.features.nuvemshop.services.nuvemshop_category_service import NuvemshopCategoryService
                cat_service = NuvemshopCategoryService(
                    tenant_id=self.tenant_id,
                    nuvemshop_repo=self.nuvemshop_repo,
                    client=client,
                )
                resolved_category_id = await cat_service.resolve_or_create_category(str(raw_cat_name))
        except Exception as cat_err:
            logger.warning(f"⚠️ [NuvemshopService] Falha ao resolver categoria para SKU '{sku}': {cat_err}")

        cat_ids_list = [resolved_category_id] if resolved_category_id else None

        existing_nuvemshop_id = product.nuvemshop_product_id

        if existing_nuvemshop_id:
            # 1. Produto já possui ID da Nuvemshop mapeado no DB -> PUT
            product_id_int = int(existing_nuvemshop_id)
            update_payload = self.build_nuvemshop_payload(product, visibility=visibility, is_update=True, category_ids=cat_ids_list)
            res = await client.update_product_metadata(product_id_int, update_payload)
            nuvemshop_id = existing_nuvemshop_id
            logger.info(f"🔄 [NuvemshopService] Produto SKU '{sku}' atualizado via PUT na Nuvemshop (ID: {nuvemshop_id}).")
        else:
            # 2. Tenta localizar por SKU via GET /products/sku/{sku} na Nuvemshop antes de criar
            ns_product = await client.get_product_by_sku(sku)

            if ns_product and "id" in ns_product:
                product_id_int = int(ns_product["id"])
                update_payload = self.build_nuvemshop_payload(product, visibility=visibility, is_update=True, category_ids=cat_ids_list)
                res = await client.update_product_metadata(product_id_int, update_payload)
                nuvemshop_id = str(product_id_int)
                logger.info(f"🔗 [NuvemshopService] SKU '{sku}' já existia na Nuvemshop (ID: {nuvemshop_id}). Atualizado via PUT.")
            else:
                # 3. Criação de novo produto na Nuvemshop via POST
                create_payload = self.build_nuvemshop_payload(product, visibility=visibility, is_update=False, category_ids=cat_ids_list)
                res = await client.create_product(create_payload)
                nuvemshop_id = str(res.get("id"))
                logger.info(f"✨ [NuvemshopService] Produto SKU '{sku}' criado via POST na Nuvemshop (ID: {nuvemshop_id}).")

        # 4. Sincronização da galeria complementar de imagens (mídias excedentes >9 ou updates)
        if nuvemshop_id:
            try:
                ai_data = getattr(product, "ai_enriched_data", {}) or {}
                raw_data = getattr(product, "raw_payload", {}) or {}
                local_images = ai_data.get("images") or raw_data.get("images") or []

                if isinstance(local_images, list) and len(local_images) > 0:
                    from app.features.nuvemshop.services.nuvemshop_image_service import NuvemshopImageService
                    image_service = NuvemshopImageService(
                        tenant_id=self.tenant_id,
                        nuvemshop_repo=self.nuvemshop_repo,
                        client=client,
                    )
                    await image_service.sync_product_gallery(
                        product_id_nuvemshop=int(nuvemshop_id),
                        local_images=local_images,
                    )
            except Exception as img_err:
                logger.warning(
                    f"⚠️ [NuvemshopService] Falha isolada na sincronização de galeria para SKU '{sku}': {img_err}"
                )

        # 5. Atualiza vinculação no PostgreSQL e atualiza status para 'Exported'
        if nuvemshop_id:
            await self.product_repo.update_external_ids(
                tenant_id=self.tenant_id,
                sku=sku,
                nuvemshop_product_id=str(nuvemshop_id),
            )

        return res



