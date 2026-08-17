class NuvemshopDomainException(Exception):
    """Exceção base para regras de negócio e infraestrutura da integração Nuvemshop."""
    def __init__(self, message: str = "Erro interno na integração com Nuvemshop."):
        super().__init__(message)


class NuvemshopSignatureError(NuvemshopDomainException):
    """Assinatura HMAC sha256 inválida ou ausente nas notificações de webhook."""
    def __init__(self, message: str = "Assinatura HMAC de webhook da Nuvemshop inválida."):
        super().__init__(message)


class NuvemshopAPIError(NuvemshopDomainException):
    """Falha de comunicação ou resposta de erro da API REST da Nuvemshop."""
    def __init__(self, message: str, status_code: int = 500, response_body: str = ""):
        self.status_code = status_code
        self.response_body = response_body
        super().__init__(f"{message} (Status: {status_code}) - Detalhes: {response_body}")


class NuvemshopSyncError(NuvemshopDomainException):
    """Falha durante a sincronização de produtos, estoque ou imagens com a Nuvemshop."""
    pass


class NuvemshopWebhookProcessingError(NuvemshopDomainException):
    """Erro interno durante a recepção ou enfileiramento de webhooks da Nuvemshop."""
    pass
