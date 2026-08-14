import json
import logging
import re
import unicodedata
from typing import Any, Dict, List, Optional
import httpx

from app.core.config.redis_db import redis_cache
from app.features.nuvemshop.infrastructure.client import NuvemshopClient
from app.features.nuvemshop.repositories import NuvemshopRepository
from app.features.nuvemshop.schemas import NuvemshopCategoryCreatePayload

logger = logging.getLogger(__name__)


class NuvemshopCategoryService:
    """
    Serviço de Domínio para Resolução De-Para, Normalização, Cache Redis (1h) e
    Criação On-Demand de Categorias na Nuvemshop.
    """

    CACHE_TTL_SECONDS = 3600  # 1 hora

    def __init__(
        self,
        tenant_id: str,
        nuvemshop_repo: Optional[NuvemshopRepository] = None,
        client: Optional[NuvemshopClient] = None,
    ):
        self.tenant_id = tenant_id
        self.nuvemshop_repo = nuvemshop_repo or NuvemshopRepository()
        self.client = client

    @staticmethod
    def normalize_category_name(name: str) -> str:
        """
        Normaliza o nome da categoria para comparação de-para:
        lowercase, remoção de acentos/diacríticos, pontuação e espaços extras.
        Exemplo: "Tênis & Esportes!" -> "tenis esportes".
        """
        if not name:
            return ""

        # 1. Decompõe caracteres Unicode e remove acentos
        nfkd_form = unicodedata.normalize("NFD", name)
        without_accents = "".join([c for c in nfkd_form if not unicodedata.combining(c)])

        # 2. Lowercase e remove caracteres especiais (mantendo apenas letras e números)
        clean = re.sub(r"[^a-z0-9\s]", " ", without_accents.lower())

        # 3. Remove espaços duplicados
        return " ".join(clean.split())

    async def _ensure_client(self) -> NuvemshopClient:
        if self.client:
            return self.client
        creds = await self.nuvemshop_repo.get_credentials(self.tenant_id)
        if not creds:
            raise ValueError(f"Credenciais Nuvemshop ausentes para o tenant '{self.tenant_id}'.")
        self.client = NuvemshopClient(store_id=creds.store_id, access_token=creds.access_token, app_email=creds.app_email)
        return self.client

    async def get_cached_categories(self, store_id: str, client: NuvemshopClient) -> List[Dict[str, Any]]:
        """
        Recupera as categorias da loja a partir do cache Redis (TTL 1h) ou realiza o GET na API Nuvemshop em caso de miss.
        Chave Redis: 'ecom:categories:nuvemshop:{store_id}'
        """
        cache_key = f"ecom:categories:nuvemshop:{store_id}"

        try:
            cached_data = await redis_cache.get(cache_key)
            if cached_data:
                logger.debug(f"⚡ [NuvemshopCategoryService] Cache HIT para categorias da loja '{store_id}'.")
                return json.loads(cached_data)
        except Exception as cache_err:
            logger.warning(f"⚠️ [NuvemshopCategoryService] Falha ao consultar Redis: {cache_err}")

        # Cache MISS -> Consulta REST API
        logger.info(f"🌐 [NuvemshopCategoryService] Cache MISS. Consultando categorias via REST API na Nuvemshop (Loja: {store_id})...")
        categories = await client.get_categories()

        try:
            await redis_cache.set(cache_key, json.dumps(categories), expire_seconds=self.CACHE_TTL_SECONDS)
        except Exception as cache_err:
            logger.warning(f"⚠️ [NuvemshopCategoryService] Falha ao gravar cache Redis: {cache_err}")

        return categories

    async def resolve_or_create_category(self, raw_category_name: str) -> Optional[int]:
        """
        Resolve uma categoria a partir da sugestão de taxonomia inferida pela IA:
        1. Normaliza a string de entrada.
        2. Tenta localizar por correspondência exata ou normalizada nas categorias existentes da loja.
        3. Se não existir, cria a nova categoria via POST /categories e invalida o cache Redis.
        4. Retorna o ID inteiro da categoria gerada/encontrada (ou None em caso de falha graciosa).
        """
        if not raw_category_name or not raw_category_name.strip():
            return None

        clean_raw_name = raw_category_name.strip()
        norm_target = self.normalize_category_name(clean_raw_name)

        if not norm_target:
            return None

        try:
            client = await self._ensure_client()
            store_id = client.store_id
            categories = await self.get_cached_categories(store_id, client)

            # 1. Tenta mapeamento De-Para nas categorias existentes
            for cat in categories:
                if not isinstance(cat, dict):
                    continue

                name_data = cat.get("name", {})
                cat_name_pt = name_data.get("pt", "") if isinstance(name_data, dict) else str(name_data)
                norm_cat = self.normalize_category_name(cat_name_pt)

                if norm_cat == norm_target:
                    cat_id = int(cat["id"])
                    logger.info(
                        f"🎯 [NuvemshopCategoryService] Loja {store_id} | Categoria '{clean_raw_name}' "
                        f"mapeada para ID existente {cat_id}."
                    )
                    return cat_id

            # 2. Categoria inédita -> Criação On-Demand via POST /categories
            logger.info(
                f"✨ [NuvemshopCategoryService] Loja {store_id} | Categoria '{clean_raw_name}' não encontrada. "
                f"Criando nova categoria on-demand..."
            )
            create_payload = NuvemshopCategoryCreatePayload(
                name={"pt": clean_raw_name},
                description={"pt": f"Categoria {clean_raw_name}"},
            )
            new_cat = await client.create_category(create_payload)
            new_id = int(new_cat["id"])

            # 3. Invalida o cache no Redis para que a próxima consulta traga a nova lista atualizada
            cache_key = f"ecom:categories:nuvemshop:{store_id}"
            try:
                await redis_cache.delete(cache_key)
            except Exception as cache_err:
                logger.warning(f"⚠️ [NuvemshopCategoryService] Falha ao invalidar cache Redis: {cache_err}")

            logger.info(
                f"✅ [NuvemshopCategoryService] Loja {store_id} | Categoria '{clean_raw_name}' "
                f"criada com sucesso com ID {new_id}."
            )
            return new_id

        except Exception as exc:
            logger.warning(
                f"⚠️ [NuvemshopCategoryService] Falha graciosa ao resolver/criar categoria '{raw_category_name}': {exc}"
            )
            return None
