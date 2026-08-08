class AllProvidersExhaustedError(Exception):
    """Exceção lançada quando todos os provedores de LLM configurados falham."""
    pass


class LLMProviderError(Exception):
    """Exceção base para falhas operacionais em provedores de LLM."""
    pass


class OpenRouterAPIError(LLMProviderError):
    """Exceção tratada para erros da API do OpenRouter (status >= 400)."""
    def __init__(self, message: str, status_code: int = 500, response_body: str = ""):
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body


class OpenRouterRateLimitError(OpenRouterAPIError):
    """Exceção tratada para limites de requisição excedidos no OpenRouter (HTTP 429)."""
    def __init__(self, message: str = "Limite de requisições excedido no OpenRouter (HTTP 429)", response_body: str = ""):
        super().__init__(message=message, status_code=429, response_body=response_body)

