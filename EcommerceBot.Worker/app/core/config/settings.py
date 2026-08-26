from pydantic import Field, AliasChoices
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    ENVIRONMENT: str = Field(default="development", validation_alias=AliasChoices("ENVIRONMENT", "ENV"))
    
    # CORS: Whitelist de domínios permitidos em produção/dev/ngrok
    CORS_ORIGINS: str | List[str] = Field(
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
        default=None,
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
    OPENROUTER_API_KEY: str = Field(
        default="",
        validation_alias=AliasChoices("OPENROUTER_API_KEY", "OpenRouter_API_Key", "OPENROUTER_KEY")
    )
    OPENROUTER_BASE_URL: str = Field(
        default="https://openrouter.ai/api/v1",
        validation_alias=AliasChoices("OPENROUTER_BASE_URL", "OpenRouter_Base_Url")
    )
    SHOPIFY_API_VERSION: str = Field(
        default="2026-07",
        validation_alias=AliasChoices("SHOPIFY_API_VERSION", "SHOPIFY_VERSION")
    )
    SHOPIFY_CLIENT_ID: str = Field(
        default="",
        validation_alias=AliasChoices("SHOPIFY_CLIENT_ID", "SHOPIFY_API_KEY")
    )
    SHOPIFY_CLIENT_SECRET: str = Field(
        default="",
        validation_alias=AliasChoices("SHOPIFY_CLIENT_SECRET", "SHOPIFY_SECRET")
    )
    SHOPIFY_WEBHOOK_SECRET: str = Field(
        default="",
        validation_alias=AliasChoices("SHOPIFY_WEBHOOK_SECRET", "SHOPIFY_CLIENT_SECRET", "SHOPIFY_SECRET")
    )
    SHOPIFY_SCOPES: str = Field(
        default="read_products,write_products,read_inventory,write_inventory",
        validation_alias=AliasChoices("SHOPIFY_SCOPES", "SHOPIFY_SCOPE")
    )
    SHOPIFY_REDIRECT_URI: str = Field(
        default="",
        validation_alias=AliasChoices("SHOPIFY_REDIRECT_URI", "SHOPIFY_OAUTH_REDIRECT_URI")
    )
    NUVEMSHOP_CLIENT_ID: str = Field(
        default="",
        validation_alias=AliasChoices("NUVEMSHOP_CLIENT_ID", "NUVEMSHOP_APP_ID")
    )
    NUVEMSHOP_CLIENT_SECRET: str = Field(
        default="",
        validation_alias=AliasChoices("NUVEMSHOP_CLIENT_SECRET", "NUVEMSHOP_SECRET")
    )
    NUVEMSHOP_WEBHOOK_SECRET: str = Field(
        default="",
        validation_alias=AliasChoices("NUVEMSHOP_WEBHOOK_SECRET", "NUVEMSHOP_CLIENT_SECRET", "NUVEMSHOP_SECRET")
    )
    NUVEMSHOP_REDIRECT_URI: str = Field(
        default="",
        validation_alias=AliasChoices("NUVEMSHOP_REDIRECT_URI", "NUVEMSHOP_OAUTH_REDIRECT_URI")
    )
    NUVEMSHOP_SCOPES: str = Field(
        default="write_products,read_products,write_orders,read_orders",
        validation_alias=AliasChoices("NUVEMSHOP_SCOPES", "NUVEMSHOP_SCOPE")
    )
    PUBLIC_BASE_URL: str = Field(
        default="http://localhost:8000",
        validation_alias=AliasChoices("PUBLIC_BASE_URL", "API_BASE_URL")
    )
    FRONTEND_URL: str = Field(
        default="http://localhost:5173",
        validation_alias=AliasChoices("FRONTEND_URL", "WEB_URL")
    )
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
    MERCADOPAGO_ACCESS_TOKEN: str | None = Field(
        default=None,
        validation_alias=AliasChoices("MERCADOPAGO_ACCESS_TOKEN", "MercadoPago_Access_Token", "MP_ACCESS_TOKEN")
    )
    ADMIN_EMAILS: str | List[str] = Field(
        default=[],
        validation_alias=AliasChoices("ADMIN_EMAILS", "ADMIN_EMAIL_LIST")
    )
    GOOGLE_CLIENT_ID: str = Field(
        default="mock_google_client_id",
        validation_alias=AliasChoices("GOOGLE_CLIENT_ID", "Google_Client_Id")
    )
    GOOGLE_CLIENT_SECRET: str = Field(
        default="mock_google_client_secret",
        validation_alias=AliasChoices("GOOGLE_CLIENT_SECRET", "Google_Client_Secret")
    )
    GOOGLE_REDIRECT_URI: str = Field(
        default="http://localhost:5173/auth/google/callback",
        validation_alias=AliasChoices("GOOGLE_REDIRECT_URI", "Google_Redirect_Uri")
    )
    RESEND_API_KEY: str | None = Field(
        default=None,
        validation_alias=AliasChoices("RESEND_API_KEY", "Resend_Api_Key", "RESEND_KEY")
    )
    EMAIL_FROM: str = Field(
        default="ECom AutoBot <notificacoes@ecommercebot.com>",
        validation_alias=AliasChoices("EMAIL_FROM", "DEFAULT_FROM_EMAIL")
    )
    ENABLE_EMAIL_SENDING: bool = Field(
        default=True,
        validation_alias=AliasChoices("ENABLE_EMAIL_SENDING", "EMAIL_ENABLED")
    )
    ENABLE_EMAIL_SIMULATION: bool = Field(
        default=False,
        validation_alias=AliasChoices("ENABLE_EMAIL_SIMULATION", "EMAIL_SIMULATION", "EMAIL_DRY_RUN")
    )


    def get_admin_emails_list(self) -> List[str]:
        """Retorna uma lista higienizada em lowercase dos e-mails com privilégio de admin."""
        if isinstance(self.ADMIN_EMAILS, list):
            return [e.strip().lower() for e in self.ADMIN_EMAILS if e and e.strip()]
        if isinstance(self.ADMIN_EMAILS, str) and self.ADMIN_EMAILS.strip():
            import json
            raw = self.ADMIN_EMAILS.strip()
            if raw.startswith("[") and raw.endswith("]"):
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, list):
                        return [str(e).strip().lower() for e in parsed if e and str(e).strip()]
                except Exception:
                    pass
            return [e.strip().lower() for e in raw.split(",") if e and e.strip()]
        return []

    def get_cors_origins_list(self) -> List[str]:
        """Retorna uma lista higienizada dos domínios permitidos via CORS."""
        if isinstance(self.CORS_ORIGINS, list):
            return [o.strip() for o in self.CORS_ORIGINS if o and o.strip()]
        if isinstance(self.CORS_ORIGINS, str) and self.CORS_ORIGINS.strip():
            import json
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