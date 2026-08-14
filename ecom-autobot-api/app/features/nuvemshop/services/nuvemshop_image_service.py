import asyncio
import base64
import io
import logging
from typing import Any, Dict, List, Optional, Tuple, Union
import httpx
from urllib.parse import urlparse

from app.features.nuvemshop.infrastructure.client import NuvemshopClient
from app.features.nuvemshop.repositories import NuvemshopRepository
from app.features.nuvemshop.schemas import (
    NuvemshopImageUploadPayload,
)
from app.features.nuvemshop.services.nuvemshop_rate_limiter import NuvemshopRateLimiter

logger = logging.getLogger(__name__)


class NuvemshopImageService:
    """
    Serviço de Orquestração, Validação e Upload Assíncrono de Galeria de Imagens para a Nuvemshop.
    Implementa envio em sub-lotes (chunks de 5 mídias) via asyncio.Semaphore para alta performance,
    respeitando limites de 250 imagens por produto e isolando falhas por mídia individual.
    """

    ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
    MAX_GALLERY_IMAGES = 250
    CHUNK_SIZE = 5  # Sub-lotes concorrentes para evitar gargalo de I/O e RAM

    def __init__(
        self,
        tenant_id: str,
        nuvemshop_repo: Optional[NuvemshopRepository] = None,
        client: Optional[NuvemshopClient] = None,
    ):
        self.tenant_id = tenant_id
        self.nuvemshop_repo = nuvemshop_repo or NuvemshopRepository()
        self.client = client

    @classmethod
    def validate_image_url(cls, url: str) -> bool:
        """
        Valida se a URL fornecida é sintaticamente correta (HTTP/HTTPS) e possui uma extensão permitida.
        """
        if not url or not isinstance(url, str):
            return False

        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False

        path_clean = parsed.path.lower()
        has_valid_ext = any(path_clean.endswith(ext) for ext in cls.ALLOWED_EXTENSIONS)
        return has_valid_ext

    @classmethod
    async def fetch_image_buffer_as_base64(cls, url: str) -> Optional[Tuple[str, str]]:
        """
        Baixa o conteúdo de uma URL pública diretamente para um buffer em memória (io.BytesIO)
        e retorna uma tupla (base64_attachment, filename) para upload de fallback.
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url)
                resp.raise_for_status()

                content_len = len(resp.content)
                if content_len > cls.MAX_IMAGE_SIZE_BYTES:
                    logger.warning(
                        f"⚠️ [NuvemshopImageService] Imagem excede o limite de 10 MB ({content_len} bytes): {url}"
                    )
                    return None

                buffer = io.BytesIO(resp.content)
                b64_str = base64.b64encode(buffer.getvalue()).decode("utf-8")

                parsed = urlparse(url)
                filename = parsed.path.split("/")[-1] or "image.jpg"
                if not any(filename.lower().endswith(ext) for ext in cls.ALLOWED_EXTENSIONS):
                    filename = f"{filename}.jpg"

                return b64_str, filename
        except Exception as e:
            logger.warning(f"⚠️ [NuvemshopImageService] Falha ao converter URL para buffer Base64 ({url}): {e}")
            return None

    async def _ensure_client(self) -> NuvemshopClient:
        if self.client:
            return self.client
        creds = await self.nuvemshop_repo.get_credentials(self.tenant_id)
        if not creds:
            raise ValueError(f"Credenciais Nuvemshop ausentes para o tenant '{self.tenant_id}'.")
        self.client = NuvemshopClient(store_id=creds.store_id, access_token=creds.access_token, app_email=creds.app_email)
        return self.client

    async def sync_product_gallery(
        self,
        product_id_nuvemshop: int,
        local_images: List[Union[str, Dict[str, Any]]],
        start_position: int = 1,
    ) -> List[Dict[str, Any]]:
        """
        Orquestra o upload assíncrono e ordenado de galeria para um produto na Nuvemshop.
        1. Consulta mídias existentes na Nuvemshop para evitar duplicidade (`src`).
        2. Filtra e valida URLs locais.
        3. Envia mídias em sub-lotes concorrentes (chunks de 5) via asyncio.Semaphore.
        4. Respeita o limite de 250 mídias e isola erros por imagem sem quebrar o lote.
        """
        if not local_images:
            return []

        client = await self._ensure_client()
        store_id = client.store_id

        # 1. Consulta mídias já existentes na Nuvemshop
        try:
            existing_images = await client.get_product_images(product_id_nuvemshop)
        except Exception as err:
            logger.error(
                f"❌ [NuvemshopImageService] Erro ao consultar galeria existente do produto {product_id_nuvemshop}: {err}"
            )
            existing_images = []

        existing_srcs = {img.get("src") for img in existing_images if isinstance(img, dict) and img.get("src")}
        existing_count = len(existing_images)

        if existing_count >= self.MAX_GALLERY_IMAGES:
            logger.warning(
                f"⚠️ [NuvemshopImageService] Produto {product_id_nuvemshop} já atingiu o limite de {self.MAX_GALLERY_IMAGES} imagens."
            )
            return existing_images

        # 2. Prepara candidatos a upload
        candidates: List[Tuple[str, int]] = []
        for img in local_images:
            raw_url = img if isinstance(img, str) else (img.get("src") if isinstance(img, dict) else "")
            if not raw_url:
                continue

            if not self.validate_image_url(raw_url):
                logger.warning(
                    f"⚠️ [NuvemshopImageService] Tenant {self.tenant_id} | URL de imagem inválida ou formato não suportado ignorado: '{raw_url}'"
                )
                continue

            if raw_url in existing_srcs:
                logger.debug(f"ℹ️ [NuvemshopImageService] Imagem já existente na galeria, ignorando re-upload: '{raw_url}'")
                continue

            target_pos = max(start_position, existing_count + len(candidates) + 1)
            candidates.append((raw_url, target_pos))

        available_slots = self.MAX_GALLERY_IMAGES - existing_count
        candidates = candidates[:available_slots]

        if not candidates:
            logger.info(
                f"ℹ️ [NuvemshopImageService] Tenant {self.tenant_id} | Nenhuma nova imagem pendente de upload para produto {product_id_nuvemshop}."
            )
            return existing_images

        logger.info(
            f"🚀 [NuvemshopImageService] Iniciando upload em sub-lotes de {len(candidates)} nova(s) imagem(ns) "
            f"para o produto {product_id_nuvemshop} (Tenant: {self.tenant_id})."
        )

        semaphore = asyncio.Semaphore(self.CHUNK_SIZE)
        uploaded_results: List[Dict[str, Any]] = []

        async def _upload_single_image(url: str, pos: int) -> Optional[Dict[str, Any]]:
            async with semaphore:
                try:
                    await NuvemshopRateLimiter.acquire_ticket(store_id)
                    payload = NuvemshopImageUploadPayload(src=url, position=pos)
                    res = await client.upload_product_image(product_id_nuvemshop, payload)
                    logger.info(
                        f"✅ [NuvemshopImageService] Tenant {self.tenant_id} | Produto {product_id_nuvemshop} | "
                        f"Imagem enviada com sucesso (Position: {pos}, URL: {url})."
                    )
                    return res
                except Exception as upload_err:
                    logger.warning(
                        f"⚠️ [NuvemshopImageService] Tenant {self.tenant_id} | Produto {product_id_nuvemshop} | "
                        f"Falha isolada ao enviar imagem (Position: {pos}, URL: {url}): {upload_err}"
                    )
                    # Tentativa de fallback via Buffer Base64 se a URL direta falhar
                    b64_tuple = await self.fetch_image_buffer_as_base64(url)
                    if b64_tuple:
                        b64_str, filename = b64_tuple
                        try:
                            await NuvemshopRateLimiter.acquire_ticket(store_id)
                            fallback_payload = NuvemshopImageUploadPayload(
                                attachment=b64_str,
                                filename=filename,
                                position=pos,
                            )
                            res = await client.upload_product_image(product_id_nuvemshop, fallback_payload)
                            logger.info(
                                f"✅ [NuvemshopImageService] Tenant {self.tenant_id} | Produto {product_id_nuvemshop} | "
                                f"Imagem enviada via Fallback Base64 (Position: {pos})."
                            )
                            return res
                        except Exception as fb_err:
                            logger.error(
                                f"❌ [NuvemshopImageService] Fallback Base64 também falhou para imagem (Position: {pos}): {fb_err}"
                            )
                    return None

        # Processa em sub-lotes assíncronos
        tasks = [_upload_single_image(url, pos) for url, pos in candidates]
        results = await asyncio.gather(*tasks)

        for res in results:
            if res:
                uploaded_results.append(res)

        return existing_images + uploaded_results
