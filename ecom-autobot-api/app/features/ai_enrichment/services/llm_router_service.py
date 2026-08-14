from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.settings import settings
from app.core.shared.logger import get_logger
from app.features.ai_enrichment.domain.exceptions import (
    OpenRouterAPIError,
    OpenRouterRateLimitError,
)
from app.features.ai_enrichment.infrastructure.providers.openrouter_provider import (
    OpenRouterLLMProvider,
)
from app.features.ai_enrichment.schemas import (
    LLMCompletionRequest,
    LLMCompletionResponse,
)
from app.features.products.repositories.tenant_config_repository import (
    TenantConfigRepository,
)

logger = get_logger("LLMEngineRouter")


class LLMEngineRouter:
    """
    Serviço de roteamento de IA responsável por orquestrar requisições assíncronas ao OpenRouter.
    Primeiro tenta utilizar a chave BYOK própria do tenant (`openrouter_api_key`).
    Se a chave BYOK falhar (HTTP 401/402/403) ou não estiver configurada, faz o fallback
    transparente para a chave mestre global do sistema (`OPENROUTER_API_KEY`).
    """

    def __init__(self, provider: Optional[OpenRouterLLMProvider] = None):
        self.provider = provider or OpenRouterLLMProvider()

    async def generate_completion(
        self,
        tenant_id: str,
        prompt_data: LLMCompletionRequest,
        db: Optional[AsyncSession] = None,
    ) -> LLMCompletionResponse:
        """
        Gera uma conclusão via OpenRouter aplicando prioridade BYOK do tenant com fallback para a chave mestre.
        """
        # 1. Tenta recuperar a chave BYOK do tenant no PostgreSQL / Redis
        byok_key: Optional[str] = None
        try:
            repo = TenantConfigRepository(session=db)
            byok_key = await repo.get_openrouter_byok_key(tenant_id=tenant_id)
        except Exception as repo_err:
            logger.warning(
                f"[LLMEngineRouter] Erro ao consultar chave BYOK para tenant '{tenant_id}': {repo_err}"
            )

        # 2. Se o tenant possui chave BYOK cadastrada, tenta executar primeiro via BYOK
        if byok_key:
            logger.info(f"[LLMEngineRouter] Executando chamada via chave BYOK do tenant '{tenant_id}'.")
            try:
                response = await self.provider.generate_completion(
                    request=prompt_data,
                    api_key=byok_key,
                )
                return response
            except OpenRouterAPIError as err:
                status_code = getattr(err, "status_code", None)
                if status_code in (401, 402, 403):
                    logger.warning(
                        f"[LLMEngineRouter] Chave BYOK do tenant '{tenant_id}' falhou (status {status_code}). "
                        f"Disparando alerta e executando fallback automático para a chave mestre do sistema."
                    )
                    try:
                        from app.features.emails.services.email_dispatcher import email_dispatcher
                        await email_dispatcher.publish_email_event(
                            event_name="BYOK_KEY_INVALID",
                            recipient_email=f"admin@{tenant_id}.com",
                            tenant_id=tenant_id,
                            data={
                                "provider": "OpenRouter",
                                "status_code": status_code,
                                "error_message": str(err),
                            },
                        )
                    except Exception as email_err:
                        logger.warning(
                            f"[LLMEngineRouter] Falha ao publicar evento de e-mail BYOK_KEY_INVALID: {email_err}"
                        )
                else:
                    # Erro de API que não é credencial/crédito (ex: 500), relança diretamente
                    raise err

        # 3. Fallback: Executa utilizando a chave mestre global do sistema
        global_key = (settings.OPENROUTER_API_KEY or "").strip()

        if not global_key:
            logger.error("[LLMEngineRouter] OPENROUTER_API_KEY mestre do sistema não está configurada.")
            try:
                from app.features.emails.services.email_dispatcher import email_dispatcher
                await email_dispatcher.publish_email_event(
                    event_name="BYOK_KEY_INVALID",
                    recipient_email=f"admin@{tenant_id}.com",
                    tenant_id=tenant_id,
                    data={
                        "provider": "OpenRouter",
                        "status_code": 401,
                        "error_message": "Chave de API global do OpenRouter não configurada no sistema.",
                    },
                )
            except Exception:
                pass
            raise OpenRouterAPIError("Chave de API global do OpenRouter não configurada no sistema.", status_code=401)

        logger.info(
            f"[LLMEngineRouter] Executando chamada via chave mestre global do sistema para tenant '{tenant_id}'."
        )
        try:
            return await self.provider.generate_completion(
                request=prompt_data,
                api_key=global_key,
            )
        except OpenRouterAPIError as err:
            if getattr(err, "status_code", None) in (401, 402, 403):
                try:
                    from app.features.emails.services.email_dispatcher import email_dispatcher
                    await email_dispatcher.publish_email_event(
                        event_name="BYOK_KEY_INVALID",
                        recipient_email=f"admin@{tenant_id}.com",
                        tenant_id=tenant_id,
                        data={
                            "provider": "OpenRouter",
                            "status_code": getattr(err, "status_code", 401),
                            "error_message": str(err),
                        },
                    )
                except Exception:
                    pass
            raise err
