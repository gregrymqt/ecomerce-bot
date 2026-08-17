class MercadoPagoDomainException(Exception):
    """Exceção base para regras de negócio e infraestrutura da integração Mercado Pago."""
    def __init__(self, message: str = "Erro interno no processamento do Mercado Pago."):
        super().__init__(message)


class MercadoPagoSignatureError(MercadoPagoDomainException):
    """Assinatura x-signature inválida ou ausente nas notificações de webhook."""
    def __init__(self, message: str = "Assinatura HMAC de webhook do Mercado Pago inválida."):
        super().__init__(message)


class MercadoPagoAPIError(MercadoPagoDomainException):
    """Falha de comunicação ou rejeição de resposta da API do Mercado Pago."""
    def __init__(self, message: str, status_code: int = 500, response_body: str = ""):
        self.status_code = status_code
        self.response_body = response_body
        super().__init__(f"{message} (Status: {status_code}) - Detalhes: {response_body}")


class MercadoPagoWebhookProcessingError(MercadoPagoDomainException):
    """Erro interno durante a ingestão ou roteamento do evento de webhook."""
    pass
