from pydantic import Field, AliasChoices
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    POSTGRES_URI: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/ecommerce_bot_db",
        validation_alias=AliasChoices("POSTGRES_URI", "POSTGRES_URI_PYTHON")
    )
    RABBITMQ_URL: str = Field(
        default="amqp://guest:guest@localhost:5672/",
        validation_alias=AliasChoices("RABBITMQ_URL", "RABBITMQ__HOSTNAME")
    )
    OPENAI_API_KEY: str | None = None
    GEMINI_API_KEY: str | None = None
    DISCORD_WEBHOOK_URL: str = ""
    AES_MASTER_KEY: str = Field(
        default="",
        validation_alias=AliasChoices("AES_MASTER_KEY", "AES_KEY")
    )
    JWT_SECRET_KEY: str = Field(
        default="",
        validation_alias=AliasChoices("JWT_SECRET_KEY", "JWT__KEY", "JWT__Key", "Jwt__Key")
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

    @property
    def JWT__Key(self) -> str:
        """Propriedade para retrocompatibilidade com referencias legadas."""
        return self.JWT_SECRET_KEY

    model_config = SettingsConfigDict(
        env_file=('../.env', '.env'),
        env_file_encoding='utf-8',
        extra='ignore',
        case_sensitive=False
    )

settings = Settings()

