from pydantic import Field, AliasChoices
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    ENVIRONMENT: str = Field(default="development", validation_alias=AliasChoices("ENVIRONMENT", "ENV"))
    
    # CORS: Whitelist de domínios permitidos em produção/dev
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:5173", "http://localhost:3000"],
        validation_alias=AliasChoices("CORS_ORIGINS", "ALLOWED_ORIGINS")
    )
    
    # Limite de tamanho de payload HTTP (Padrão: 10MB)
    MAX_PAYLOAD_SIZE_BYTES: int = 10 * 1024 * 1024

    POSTGRES_URI: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/ecommerce_bot_db",
        validation_alias=AliasChoices("POSTGRES_URI", "POSTGRES_URI_PYTHON")
    )
    POSTGRES_URI_TRANSACTION: str | None = Field(
        default=None,
        validation_alias=AliasChoices("POSTGRES_URI_TRANSACTION", "POSTGRES_TRANSACTION_URI")
    )
    POSTGRES_URI_SESSION: str | None = Field(
        default=None,
        validation_alias=AliasChoices("POSTGRES_URI_SESSION", "POSTGRE_URI_SESSION", "POSTRGRE_URI_SESSION", "POSTGRES_SESSION_URI")
    )
    DB_SSL_CERT_PATH: str | None = Field(
        default="prod-ca-2021.crt",
        validation_alias=AliasChoices("DB_SSL_CERT_PATH", "SSL_CERT_PATH", "POSTGRES_SSL_CERT")
    )
    RABBITMQ_URL: str = Field(
        default="amqp://guest:guest@localhost:5672/",
        validation_alias=AliasChoices("RABBITMQ_URL", "RABBITMQ__HOSTNAME")
    )
    DISCORD_WEBHOOK_URL: str = ""
    AES_MASTER_KEY: str = Field(
        default="",
        validation_alias=AliasChoices("AES_MASTER_KEY", "AES_KEY")
    )
    JWT_SECRET_KEY: str = Field(
        default="",
        validation_alias=AliasChoices("JWT_SECRET_KEY", "JWT__KEY", "JWT__Key", "Jwt__Key")
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=60 * 24,
        validation_alias=AliasChoices("ACCESS_TOKEN_EXPIRE_MINUTES", "JWT_EXPIRE_MINUTES")
    )
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_PASSWORD: str | None = Field(
        default=None,
        validation_alias=AliasChoices("REDIS_PASSWORD", "REDIS__PASSWORD")
    )
    DEEPSEEK_API_KEY: str | None = Field(
        default=None,
        validation_alias=AliasChoices("DEEPSEEK_API_KEY", "Deepseek_Api_Key", "DEEPSEEK_KEY")
    )
    GROQ_API_KEY: str | None = Field(
        default=None,
        validation_alias=AliasChoices("GROQ_API_KEY", "Groq_API_KEY", "GROQ_KEY")
    )
    OPENROUTER_API_KEY: str | None = Field(
        default=None,
        validation_alias=AliasChoices("OPENROUTER_API_KEY", "OpenRouter_API_Key", "OPENROUTER_KEY")
    )
    MERCADOPAGO_ACCESS_TOKEN: str | None = Field(
        default=None,
        validation_alias=AliasChoices("MERCADOPAGO_ACCESS_TOKEN", "MercadoPago_Access_Token", "MP_ACCESS_TOKEN")
    )

    @property
    def JWT__Key(self) -> str:
        """Propriedade para retrocompatibilidade com referencias legadas."""
        return self.JWT_SECRET_KEY

    def get_transaction_db_url(self) -> str:
        """Retorna a URL de conexão para Transaction pooler (ex: pgBouncer porta 6543)."""
        url = self.POSTGRES_URI_TRANSACTION or self.POSTGRES_URI
        if url and url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    def get_session_db_url(self) -> str:
        """Retorna a URL de conexão para Session/Direct mode (ex: porta 5432) usada pelo Alembic."""
        url = self.POSTGRES_URI_SESSION or self.POSTGRES_URI
        if url and url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    model_config = SettingsConfigDict(
        env_file=('../.env', '.env', '../infra/dev/.env.dev', 'infra/dev/.env.dev', '../../infra/dev/.env.dev'),
        env_file_encoding='utf-8',
        extra='ignore',
        case_sensitive=False
    )

settings = Settings()