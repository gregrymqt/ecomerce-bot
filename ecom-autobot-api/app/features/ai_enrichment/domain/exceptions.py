class AllProvidersExhaustedError(Exception):
    """Exceção lançada quando todos os provedores de LLM configurados falham."""
    pass


class LLMProviderError(Exception):
    """Exceção base para falhas operacionais em provedores de LLM."""
    pass
