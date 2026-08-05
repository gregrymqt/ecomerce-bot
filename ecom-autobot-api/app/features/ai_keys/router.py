from fastapi import APIRouter, HTTPException, Depends, Header, status
from app.features.ai_keys.schemas import AIKeyCreate
from app.features.ai_keys.domain.enums import AIProvider
from app.features.ai_keys.services.ai_key_service import AIKeyService
from app.features.ai_enrichment.domain.exceptions import LLMProviderError
from app.core.security.auth import get_current_tenant_user
from app.features.auth.schemas import AuthenticatedUser
from app.core.shared.logger import get_logger

logger = get_logger("AIKeysRouter")

router = APIRouter(prefix="/ai-keys", tags=["AI Keys"])


@router.post("/test", status_code=status.HTTP_200_OK)
async def test_ai_key(
    payload: AIKeyCreate,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
):
    """
    Testa a autenticidade e validade de uma chave de API de IA antes do salvamento.
    Para o provedor OPENROUTER, executa uma verificação leve no gateway da API.
    """
    provider = payload.provider
    if provider == AIProvider.OPENROUTER:
        try:
            await AIKeyService.test_openrouter_key(
                api_key=payload.api_key,
                preferred_models=payload.preferred_models,
            )
            return {
                "status": "success",
                "message": "Chave do OpenRouter autenticada com sucesso.",
            }
        except LLMProviderError as e:
            logger.warning(f"Falha na autenticação da chave do OpenRouter: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            )
        except Exception as e:
            logger.error("Erro interno ao testar chave de API do OpenRouter", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Não foi possível autenticar a chave do OpenRouter. Verifique as credenciais informadas.",
            )

    return {
        "status": "success",
        "message": f"Chave do provedor '{provider.value}' recebida para teste.",
    }


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
async def save_ai_key(
    payload: AIKeyCreate,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
):
    """
    Criptografa (AES-256 GCM) e salva a chave de API de um provedor de IA para o tenant.
    """
    try:
        await AIKeyService.save_key(tenant_id=x_tenant_id, payload=payload)
        return {
            "status": "success",
            "message": f"Chave de API do provedor '{payload.provider.value}' criptografada e salva com sucesso.",
        }
    except Exception as e:
        logger.error(f"Erro ao salvar chave de API para o tenant {x_tenant_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Erro ao criptografar e salvar a chave de API.",
        )
