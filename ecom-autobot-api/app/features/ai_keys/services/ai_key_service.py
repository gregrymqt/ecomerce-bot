from typing import Optional, List
import httpx

from app.core.security.crypto import (
    encrypt_api_key,
    decrypt_api_key,
    save_tenant_key,
    get_tenant_key,
    get_tenant_preferred_models,
)
from app.features.ai_keys.domain.enums import AIProvider
from app.features.ai_keys.schemas import AIKeyCreate, AIKeyResponse
from app.features.ai_enrichment.domain.exceptions import LLMProviderError
from app.core.shared.logger import get_logger

logger = get_logger("AIKeyService")


class AIKeyService:
    """Serviço de gestão e salvamento criptografado (BYOK) de chaves de IA dos Tenants."""

    @staticmethod
    async def save_key(tenant_id: str, payload: AIKeyCreate) -> str:
        """Criptografa com AES-256 GCM e salva a chave do tenant no PostgreSQL."""
        provider_name = payload.provider.value if isinstance(payload.provider, AIProvider) else str(payload.provider)
        encrypted_key = await save_tenant_key(
            tenant_id=tenant_id,
            provider=provider_name,
            raw_token=payload.api_key,
            preferred_models=payload.preferred_models,
        )
        return encrypted_key

    @staticmethod
    async def get_decrypted_key(tenant_id: str, provider: AIProvider | str) -> Optional[str]:
        """Obtém a chave descriptografada apenas em memória no escopo de execução."""
        provider_str = provider.value if isinstance(provider, AIProvider) else str(provider)
        return await get_tenant_key(tenant_id, provider_str)

    @staticmethod
    async def test_openrouter_key(api_key: str, preferred_models: Optional[List[str]] = None) -> bool:
        """Realiza um ping/teste leve na API do OpenRouter para validar a autenticidade da chave."""
        url = "https://openrouter.ai/api/v1/auth/key"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "HTTP-Referer": "https://ecomautobot.com",
            "X-Title": "ECom-Auto-Bot",
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, headers=headers)
                if response.status_code == 200:
                    return True

                # Caso a rota /auth/key não esteja disponível, realiza um fallback ping via chat/completions (1 token)
                if response.status_code in (404, 405):
                    models = preferred_models or ["groq/llama-3.3-70b", "openai/gpt-4o-mini"]
                    chat_url = "https://openrouter.ai/api/v1/chat/completions"
                    chat_payload = {
                        "models": models,
                        "messages": [{"role": "user", "content": "ping"}],
                        "max_tokens": 1,
                    }
                    res = await client.post(chat_url, headers=headers, json=chat_payload)
                    if res.status_code == 200:
                        return True
                    if res.status_code in (401, 403):
                        raise LLMProviderError("Chave de API do OpenRouter inválida ou não autorizada.")
                    if res.status_code == 429:
                        raise LLMProviderError("Limite de requisições ou cota (429) excedido no OpenRouter.")
                    raise LLMProviderError(f"Falha de autenticação do OpenRouter (HTTP {res.status_code}).")

                if response.status_code in (401, 403):
                    raise LLMProviderError("Chave de API do OpenRouter inválida ou não autorizada.")
                if response.status_code == 429:
                    raise LLMProviderError("Limite de cota ou rate limit (429) excedido na chave do OpenRouter.")

                raise LLMProviderError(f"Falha ao validar chave do OpenRouter (HTTP {response.status_code}).")
        except httpx.RequestError as e:
            raise LLMProviderError(f"Erro de conexão ao acessar o gateway OpenRouter: {type(e).__name__}") from e
