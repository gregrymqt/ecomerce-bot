import logging
import re
import urllib.parse
from typing import Optional

import httpx
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.settings import settings
from app.features.auth.domain.models import UserModel
from app.features.auth.repositories.user_repository import UserRepository
from app.features.auth.schemas import (
    AuthTokenResponse,
    GoogleUserPayload,
)


logger = logging.getLogger(__name__)


class GoogleAuthService:
    """
    Serviço de Aplicação para autenticação social via Google OAuth 2.0.
    Responsável por montar a URL de consentimento, trocar códigos de autorização
    por dados de perfil via HTTP assíncrono (httpx) e autenticar/vincular usuários e tenants.
    """

    def __init__(self, user_repo: Optional[UserRepository] = None):
        self.user_repo = user_repo

    def get_google_auth_url(self, state: Optional[str] = None) -> str:
        """
        Gera a URL de redirecionamento para o consentimento do Google OAuth 2.0.
        Solicita os escopos 'openid', 'email' e 'profile'.
        """
        base_url = "https://accounts.google.com/o/oauth2/v2/auth"
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "select_account",
        }
        if state:
            params["state"] = state

        query_string = urllib.parse.urlencode(params)
        return f"{base_url}?{query_string}"

    async def exchange_code_for_user_info(self, code: str) -> GoogleUserPayload:
        """
        Realiza a troca assíncrona do 'code' do Google pelo token de acesso
        e recupera as informações do perfil do usuário via API Google OAuth2.
        """
        async with httpx.AsyncClient(timeout=10.0) as client:
            # 1. Troca do authorization code pelo access token
            token_url = "https://oauth2.googleapis.com/token"
            data = {
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            }

            try:
                token_resp = await client.post(token_url, data=data)
            except Exception as req_err:
                logger.error(f"Erro de conexão ao acessar a API do Google Token: {req_err}")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Falha ao conectar com o serviço de autenticação do Google.",
                )

            if token_resp.status_code != 200:
                logger.error(f"Erro na troca do código Google por token: {token_resp.text}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Código de autorização do Google inválido ou expirado.",
                )

            token_data = token_resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Access token não retornado pelo Google.",
                )

            # 2. Busca do perfil do usuário com o access token
            userinfo_url = "https://www.googleapis.com/oauth2/v2/userinfo"
            headers = {"Authorization": f"Bearer {access_token}"}

            try:
                userinfo_resp = await client.get(userinfo_url, headers=headers)
            except Exception as req_err:
                logger.error(f"Erro de conexão ao buscar perfil do usuário no Google: {req_err}")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Falha ao buscar dados de perfil do Google.",
                )

            if userinfo_resp.status_code != 200:
                logger.error(f"Erro ao buscar dados do usuário Google: {userinfo_resp.text}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Falha ao recuperar informações de perfil do Google.",
                )

            user_data = userinfo_resp.json()

            email = user_data.get("email")
            sub = user_data.get("sub") or user_data.get("id")
            name = user_data.get("name")
            picture = user_data.get("picture")
            email_verified = user_data.get("email_verified", user_data.get("verified_email", False))

            if not email or not sub:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Dados incompletos retornados pelo Google OAuth.",
                )

            return GoogleUserPayload(
                email=email.lower(),
                sub=str(sub),
                name=name,
                picture=picture,
                email_verified=bool(email_verified),
            )

    async def authenticate_google_user(
        self,
        db: Optional[AsyncSession] = None,
        google_user: Optional[GoogleUserPayload] = None,
        tenant_name: Optional[str] = None,
    ) -> AuthTokenResponse:
        """
        Valida ou cria o usuário no banco PostgreSQL, realiza o vínculo do Tenant
        e emite o token JWT de acesso da aplicação.
        """
        if google_user is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dados do usuário Google não fornecidos.",
            )

        from app.core.security.auth import create_access_token

        user_repo = UserRepository(session=db) if db is not None else (self.user_repo or UserRepository())
        clean_email = google_user.email.lower()


        existing_user = await user_repo.get_by_email(clean_email)

        # -------------------------------------------------------------
        # CASO 1: Usuário já cadastrado no sistema
        # -------------------------------------------------------------
        if existing_user:
            admin_emails = settings.get_admin_emails_list()
            is_configured_admin = clean_email in admin_emails
            role = "admin" if is_configured_admin else existing_user.role

            if is_configured_admin and existing_user.role != "admin":
                try:
                    await user_repo.update_user(existing_user.id, {"role": "admin"})
                    existing_user.role = "admin"
                except Exception as update_err:
                    logger.warning(f"Erro ao atualizar privilégios de admin para '{clean_email}': {update_err}")

            user_tenants = list(existing_user.tenants) if existing_user.tenants else ["ecommerce_demo"]

            # Caso fornecido um novo tenant_name no callback, vincula-o ao usuário existente
            if tenant_name and tenant_name.strip():
                new_tenant_id = self._generate_tenant_id(tenant_name)
                if new_tenant_id not in user_tenants:
                    user_tenants.append(new_tenant_id)
                    try:
                        await user_repo.update_user(existing_user.id, {"tenants": user_tenants})
                        existing_user.tenants = user_tenants
                    except Exception as update_err:
                        logger.warning(f"Erro ao vincular novo tenant ao usuário existente: {update_err}")

            active_tenant_id = user_tenants[0] if user_tenants else "ecommerce_demo"

            token_data = {
                "sub": existing_user.id,
                "email": existing_user.email,
                "name": existing_user.name,
                "role": role,
                "is_admin": (role == "admin"),
                "tenants": user_tenants,
            }

            access_token = create_access_token(data=token_data)

            return AuthTokenResponse(
                access_token=access_token,
                token_type="bearer",
                user_id=existing_user.id,
                email=existing_user.email,
                name=existing_user.name,
                tenants=user_tenants,
                tenant_id=active_tenant_id,
            )

        # -------------------------------------------------------------
        # CASO 2: Usuário Novo (Primeiro Acesso)
        # -------------------------------------------------------------
        if not tenant_name or not tenant_name.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O nome da organização/empresa (tenant_name) é obrigatório para o primeiro acesso via Google.",
            )

        tenant_id = self._generate_tenant_id(tenant_name)
        admin_emails = settings.get_admin_emails_list()
        role = "admin" if clean_email in admin_emails else "user"

        new_user = UserModel(
            email=clean_email,
            password_hash="GOOGLE_OAUTH_ACCOUNT",
            name=google_user.name or clean_email.split("@")[0].capitalize(),
            role=role,
            tenants=[tenant_id],
            is_google_user=True,
        )

        try:
            created_user = await user_repo.create_user(new_user)
            user_id = created_user.id
            user_name = created_user.name
            user_tenants = created_user.tenants

            # Disparo assíncrono do e-mail de boas-vindas para primeiro acesso Google
            from app.features.emails.services.email_dispatcher import email_dispatcher
            await email_dispatcher.publish_email_event(
                event_name="USER_WELCOME",
                recipient_email=created_user.email,
                recipient_name=created_user.name,
                tenant_id=tenant_id,
                data={"user_id": created_user.id, "auth_provider": "google"},
            )
        except Exception as db_err:
            logger.warning(f"Falha ao cadastrar novo usuário Google no banco de dados ({db_err}). Executando em memória.")
            user_id = f"usr_g_{hash(clean_email) & 0xffffffff}"
            user_name = google_user.name or clean_email.split("@")[0].capitalize()
            user_tenants = [tenant_id]

        token_data = {
            "sub": user_id,
            "email": clean_email,
            "name": user_name,
            "role": role,
            "is_admin": (role == "admin"),
            "tenants": user_tenants,
        }

        access_token = create_access_token(data=token_data)

        return AuthTokenResponse(
            access_token=access_token,
            token_type="bearer",
            user_id=user_id,
            email=clean_email,
            name=user_name,
            tenants=user_tenants,
            tenant_id=tenant_id,
        )

    @staticmethod
    def _generate_tenant_id(tenant_name: str) -> str:
        """
        Gera um slug seguro para tenant_id a partir do nome da organização.
        Exemplo: 'Minha Loja 123' -> 'minha_loja_123'
        """
        cleaned = re.sub(r"[^a-zA-Z0-9_]", "_", tenant_name.strip())
        slug = re.sub(r"_+", "_", cleaned).strip("_").lower()
        return slug or "tenant_default"
