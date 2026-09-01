from typing import List, Union, Tuple
from pathlib import Path
from pydantic import Field, AliasChoices
from pydantic_settings import BaseSettings, SettingsConfigDict
import json
import os


def resolve_root_env_files() -> Tuple[str, ...]:
    """
    Busca dinamicamente o arquivo .env mestre subindo a árvore de diretórios
    a partir da localização deste arquivo até a raiz do monorepo.
    """
    env_candidates = []
    
    # 1. Busca ascendente a partir deste arquivo (app/core/config/settings.py)
    current = Path(__file__).resolve().parent
    for _ in range(6):
        candidate = current / ".env"
        if candidate.is_file():
            env_candidates.append(str(candidate))
            break
        if current.parent == current:
            break
        current = current.parent

    # 2. Candidatos relativos de fallback
    env_candidates.extend(['.env', '../.env', '../../.env', '../infra/dev/.env.dev', 'infra/dev/.env.dev'])
    
    return tuple(env_candidates)


class Settings(BaseSettings):
    """
    Configurações centralizadas do microsserviço AI/ML Worker (Python).
    Focado estritamente em inferência LLM, Web Scraping inteligente e Machine Learning.
    (Sem persistência direta em banco de dados — comunicação 100% via RabbitMQ).
    """
    ENVIRONMENT: str = Field(default="development", validation_alias=AliasChoices("ENVIRONMENT", "ENV"))
    
    # CORS: Whitelist de domínios permitidos
    CORS_ORIGINS: Union[str, List[str]] = Field(
        default=["http://localhost:5173", "http://localhost:3000"],
        validation_alias=AliasChoices("CORS_ORIGINS", "ALLOWED_ORIGINS")
    )
    
    # Limite de tamanho de payload HTTP (Padrão: 10MB)
    MAX_PAYLOAD_SIZE_BYTES: int = 10 * 1024 * 1024

    # Broker de Mensageria RabbitMQ
    RABBITMQ_URL: str = Field(
        default="amqp://guest:guest@localhost:5672/",  # nosemgrep
        validation_alias=AliasChoices("RABBITMQ_URL", "RabbitMQ__Url", "RABBITMQ__HOSTNAME")
    )

    # Cache e Pub/Sub Redis
    REDIS_URL: str = Field(
        default="redis://localhost:6379",  # nosemgrep
        validation_alias=AliasChoices("REDIS_URL", "Redis__ConnectionString", "ConnectionStrings__Redis")
    )
    REDIS_PASSWORD: str | None = Field(
        default=None,
        validation_alias=AliasChoices("REDIS_PASSWORD", "Redis__Password", "REDIS__PASSWORD")
    )

    # Segredos de Segurança e Telemetria Interna
    INTERNAL_SERVICE_KEY: str = Field(
        default="dev_internal_secret_key_change_in_prod",
        validation_alias=AliasChoices("INTERNAL_SERVICE_KEY", "Security__InternalServiceKey")
    )
    AES_MASTER_KEY: str = Field(
        default="",
        validation_alias=AliasChoices("AES_MASTER_KEY", "Security__AesMasterKey")
    )

    # Provedores de IA / LLMs
    OPENROUTER_API_KEY: str = Field(
        default="",
        validation_alias=AliasChoices("OPENROUTER_API_KEY", "OpenRouter_API_Key", "OPENROUTER_KEY")
    )
    OPENROUTER_BASE_URL: str = Field(
        default="https://openrouter.ai/api/v1",
        validation_alias=AliasChoices("OPENROUTER_BASE_URL", "OpenRouter_Base_Url")
    )
    DEEPSEEK_API_KEY: str | None = Field(
        default=None,
        validation_alias=AliasChoices("DEEPSEEK_API_KEY", "Deepseek_Api_Key", "DEEPSEEK_KEY")
    )
    GROQ_API_KEY: str | None = Field(
        default=None,
        validation_alias=AliasChoices("GROQ_API_KEY", "Groq_API_KEY", "GROQ_KEY")
    )
    OPENAI_API_KEY: str | None = Field(
        default=None,
        validation_alias=AliasChoices("OPENAI_API_KEY", "OpenAI_API_Key", "OPENAI_KEY")
    )

    # Modelos Padrão e Fallbacks
    DEFAULT_PRIMARY_MODEL: str = Field(
        default="deepseek/deepseek-chat",
        validation_alias=AliasChoices("DEFAULT_PRIMARY_MODEL", "Primary_Model")
    )
    DEFAULT_FALLBACK_MODEL_1: str = Field(
        default="groq/llama-3.3-70b-versatile",
        validation_alias=AliasChoices("DEFAULT_FALLBACK_MODEL_1", "Fallback_Model_1")
    )
    DEFAULT_FALLBACK_MODEL_2: str = Field(
        default="google/gemini-2.0-flash-001",
        validation_alias=AliasChoices("DEFAULT_FALLBACK_MODEL_2", "Fallback_Model_2")
    )

    # Alertas e Telemetria
    LOW_BALANCE_THRESHOLD: int = 10
    DISCORD_WEBHOOK_URL: str = Field(
        default="",
        validation_alias=AliasChoices("DISCORD_WEBHOOK_URL", "Discord__WebhookUrl")
    )

    # URLs da Aplicação
    PUBLIC_BASE_URL: str = Field(
        default="http://localhost:8000",
        validation_alias=AliasChoices("PUBLIC_BASE_URL", "App__BaseUrl", "API_BASE_URL")
    )
    FRONTEND_URL: str = Field(
        default="http://localhost:5173",
        validation_alias=AliasChoices("FRONTEND_URL", "App__FrontendUrl", "WEB_URL")
    )

    def get_cors_origins_list(self) -> List[str]:
        """Retorna uma lista higienizada dos domínios permitidos via CORS."""
        if isinstance(self.CORS_ORIGINS, list):
            return [o.strip() for o in self.CORS_ORIGINS if o and o.strip()]
        if isinstance(self.CORS_ORIGINS, str) and self.CORS_ORIGINS.strip():
            raw = self.CORS_ORIGINS.strip()
            if raw.startswith("[") and raw.endswith("]"):
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, list):
                        return [str(o).strip() for o in parsed if o and str(o).strip()]
                except Exception:
                    pass
            return [o.strip() for o in raw.split(",") if o and o.strip()]
        return ["http://localhost:5173", "http://localhost:3000"]

    model_config = SettingsConfigDict(
        env_file=resolve_root_env_files(),
        env_file_encoding='utf-8',
        extra='ignore',
        case_sensitive=False
    )

settings = Settings()