import asyncio
import json
import logging
import uuid
from typing import Any, Dict, List, Optional
import httpx
from fastapi import HTTPException, status

from app.core.config.redis_db import redis_cache
from app.core.config.settings import settings
from app.core.security.crypto import encrypt_api_key
from app.features.nuvemshop.infrastructure.client import NuvemshopClient
from app.features.nuvemshop.repositories import NuvemshopRepository
from app.features.nuvemshop.schemas import (
    NuvemshopOAuthAuthorizeResponse,
    NuvemshopOAuthTokenResponse,
    NuvemshopWebhookRegistrationPayload,
)
from app.features.products.repositories.tenant_config_repository import TenantConfigRepository

logger = logging.getLogger(__name__)


class NuvemshopOAuthService:
    """
    Serviço de Aplicação e Domínio para Instalação OAuth 2.0 em 1-Clique e Auto-Registro de Webhooks.
    Gerencia handshake seguro, proteção anti-CSRF via token state no Redis, criptografia de credenciais (AES-256 GCM)
    e auto-subscrição resiliente de eventos no ecossistema Nuvemshop.
    """

    STATE_TTL_SECONDS = 600  # 10 minutos de expiração para o token anti-CSRF
    NUVEMSHOP_OAUTH_AUTH_URL = "https://www.nuvemshop.com.br/apps/{client_id}/authorize"
    NUVEMSHOP_OAUTH_TOKEN_URL = "https://www.nuvemshop.com.br/apps/authorize/token"
    REQUIRED_WEBHOOK_EVENTS = [
        "product/created",
        "product/updated",
        "product/deleted",
        "app/uninstalled",
    ]

    def __init__(
        self,
        tenant_repo: Optional[TenantConfigRepository] = None,
        nuvemshop_repo: Optional[NuvemshopRepository] = None,
    ):
        self.tenant_repo = tenant_repo or TenantConfigRepository()
        self.nuvemshop_repo = nuvemshop_repo or NuvemshopRepository(tenant_repo=self.tenant_repo)

    async def generate_authorize_url(self, tenant_id: str) -> NuvemshopOAuthAuthorizeResponse:
        """
        Inicia o handshake OAuth 2.0:
        1. Gera token state anti-CSRF único (UUID v4).
        2. Armazena no Redis 'ecom:oauth:state:nuvemshop:{state}' com TTL de 10 minutos vinculando ao tenant_id.
        3. Retorna a URL de consentimento oficial da Nuvemshop.
        """
        client_id = settings.NUVEMSHOP_CLIENT_ID
        if not client_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="NUVEMSHOP_CLIENT_ID não está configurado no servidor.",
            )

        state_token = str(uuid.uuid4())
        redis_key = f"ecom:oauth:state:nuvemshop:{state_token}"

        try:
            await redis_cache.set(redis_key, tenant_id, expire_seconds=self.STATE_TTL_SECONDS)
        except Exception as err:
            logger.error(f"❌ [NuvemshopOAuthService] Falha ao salvar token state no Redis: {err}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Falha interna ao inicializar sessão de autorização OAuth.",
            )

        scopes = settings.NUVEMSHOP_SCOPES.replace(",", " ")
        authorize_url = (
            f"{self.NUVEMSHOP_OAUTH_AUTH_URL.format(client_id=client_id)}"
            f"?response_type=code&scope={scopes}&state={state_token}"
        )

        if settings.NUVEMSHOP_REDIRECT_URI:
            authorize_url += f"&redirect_uri={settings.NUVEMSHOP_REDIRECT_URI}"

        logger.info(f"🔑 [NuvemshopOAuthService] URL de autorização OAuth gerada para tenant '{tenant_id}' (State: {state_token}).")

        return NuvemshopOAuthAuthorizeResponse(authorize_url=authorize_url, state=state_token)

    async def process_callback(self, code: str, state: str) -> Dict[str, Any]:
        """
        Processa o callback OAuth da Nuvemshop:
        1. Valida o token state no Redis (mitigação CSRF).
        2. Troca o code pelo access_token via POST /apps/authorize/token.
        3. Criptografa o token em repouso (AES-256 GCM) e salva no TenantConfigRepository.
        4. Dispara o auto-registro de webhooks da loja.
        """
        if not code or not state:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parâmetros 'code' e 'state' são obrigatórios.",
            )

        # 1. Validação Anti-CSRF
        redis_key = f"ecom:oauth:state:nuvemshop:{state}"
        tenant_id = None
        try:
            tenant_id = await redis_cache.get(redis_key)
            if not tenant_id:
                logger.warning(f"⚠️ [NuvemshopOAuthService] Token state inválido ou expirado: {state}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Token 'state' inválido ou expirado. Inicie o fluxo de autorização novamente.",
                )
            await redis_cache.delete(redis_key)
        except HTTPException:
            raise
        except Exception as cache_err:
            logger.error(f"❌ [NuvemshopOAuthService] Erro ao validar state no Redis: {cache_err}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao verificar autenticidade da sessão OAuth.",
            )

        tenant_id = str(tenant_id)

        # 2. Token Exchange na Nuvemshop
        client_id = settings.NUVEMSHOP_CLIENT_ID
        client_secret = settings.NUVEMSHOP_CLIENT_SECRET
        if not client_id or not client_secret:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Credenciais da aplicação parceira Nuvemshop (Client ID/Secret) não configuradas.",
            )

        token_payload = {
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "authorization_code",
            "code": code,
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(self.NUVEMSHOP_OAUTH_TOKEN_URL, json=token_payload)
                response.raise_for_status()
                token_data = response.json()
        except httpx.HTTPStatusError as http_err:
            logger.error(f"❌ [NuvemshopOAuthService] Erro no Token Exchange na Nuvemshop: {http_err.response.text}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Falha na troca do código de autorização: {http_err.response.text}",
            )
        except Exception as exc:
            logger.error(f"❌ [NuvemshopOAuthService] Erro de comunicação com o servidor OAuth Nuvemshop: {exc}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Não foi possível conectar ao servidor OAuth da Nuvemshop.",
            )

        access_token = token_data.get("access_token")
        store_id = token_data.get("user_id") or token_data.get("store_id")

        if not access_token or not store_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Resposta de token da Nuvemshop sem access_token ou store_id válidos.",
            )

        # 3. Criptografia AES-256 GCM e Persistência de Credenciais do Tenant
        encrypted_token = encrypt_api_key(str(access_token))
        encrypted_keys = {
            "nuvemshop_store_id": str(store_id),
            "nuvemshop_access_token": encrypted_token,
            "email": f"store{store_id}@nuvemshop.com",
            "scope": token_data.get("scope", settings.NUVEMSHOP_SCOPES),
            "is_active": True,
        }

        await self.tenant_repo.upsert(
            tenant_id=tenant_id,
            encrypted_keys=encrypted_keys,
        )

        logger.info(
            f"🎉 [NuvemshopOAuthService] Instalação OAuth 1-Clique concluída! "
            f"Tenant '{tenant_id}' vinculado com sucesso à loja Nuvemshop '{store_id}'."
        )

        # 4. Auto-Registro Resiliente de Webhooks pós-autorização
        webhooks_registered = []
        try:
            webhooks_registered = await self.auto_register_webhooks(
                tenant_id=tenant_id,
                store_id=int(store_id),
                access_token=str(access_token),
            )
        except Exception as wh_err:
            logger.warning(
                f"⚠️ [NuvemshopOAuthService] Autenticação concluída, mas ocorreu um aviso no auto-registro de webhooks: {wh_err}"
            )

        return {
            "status": "success",
            "message": f"Integração Nuvemshop instalada com sucesso para o tenant '{tenant_id}'.",
            "tenant_id": tenant_id,
            "store_id": int(store_id),
            "webhooks_registered": len(webhooks_registered),
        }

    async def auto_register_webhooks(
        self,
        tenant_id: str,
        store_id: int,
        access_token: str,
    ) -> List[Dict[str, Any]]:
        """
        Cadastra automaticamente a URL pública de webhooks da aplicação na API REST da Nuvemshop.
        1. Consulta webhooks existentes para evitar duplicidade.
        2. Subcreve eventos obrigatórios (product/created, product/updated, product/deleted, app/uninstalled).
        3. Trata erros transitórios com resiliência sem quebrar o estado de autorização do lojista.
        """
        base_url = settings.PUBLIC_BASE_URL.rstrip("/")
        webhook_public_url = f"{base_url}/api/v1/nuvemshop/webhooks"

        client = NuvemshopClient(store_id=str(store_id), access_token=access_token)

        # 1. Consulta webhooks existentes na loja
        try:
            existing_webhooks = await client.get_webhooks()
        except Exception as e:
            logger.warning(f"⚠️ [NuvemshopOAuthService] Não foi possível consultar webhooks existentes na loja {store_id}: {e}")
            existing_webhooks = []

        existing_events = {
            wh.get("event")
            for wh in existing_webhooks
            if isinstance(wh, dict) and wh.get("url") == webhook_public_url
        }

        registered_webhooks: List[Dict[str, Any]] = []

        # 2. Cadastro dos eventos obrigatórios pendentes
        for event in self.REQUIRED_WEBHOOK_EVENTS:
            if event in existing_events:
                logger.info(f"ℹ️ [NuvemshopOAuthService] Webhook para '{event}' já cadastrado na loja {store_id}.")
                continue

            try:
                payload = NuvemshopWebhookRegistrationPayload(event=event, url=webhook_public_url)
                res = await client.create_webhook(payload)
                registered_webhooks.append(res)
                logger.info(
                    f"✅ [NuvemshopOAuthService] Auto-registro concluído: Webhook '{event}' "
                    f"cadastrado para loja {store_id} (URL: {webhook_public_url})."
                )
            except Exception as reg_err:
                logger.error(
                    f"❌ [NuvemshopOAuthService] Falha ao auto-registrar webhook '{event}' para loja {store_id}: {reg_err}"
                )

        return registered_webhooks
