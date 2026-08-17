class ScraperDomainException(Exception):
    """Exceção base para regras de negócio e falhas na engine de Web Scraping."""
    def __init__(self, message: str = "Erro interno no serviço de Web Scraping."):
        super().__init__(message)


class ScraperExecutionError(ScraperDomainException):
    """Falha durante a navegação HTTP ou extração do conteúdo HTML/Markdown."""
    def __init__(self, target_url: str, details: str = ""):
        super().__init__(f"Falha ao executar extração na URL '{target_url}'. Detalhes: {details}")
        self.target_url = target_url
        self.details = details


class ScraperParserError(ScraperDomainException):
    """Falha durante a desserialização de metadados estruturados (JSON-LD ou LLM)."""
    def __init__(self, parser_type: str, details: str = ""):
        super().__init__(f"Falha no parser '{parser_type}': {details}")
        self.parser_type = parser_type
        self.details = details


class ScraperQuotaError(ScraperDomainException):
    """Saldo insuficiente de créditos para agendar tarefa de extração."""
    def __init__(self, message: str = "Saldo insuficiente para executar a extração de produtos."):
        super().__init__(message)
