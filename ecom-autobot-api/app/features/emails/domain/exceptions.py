class EmailDomainException(Exception):
    """Exceção base para regras de negócio do módulo de emails."""
    def __init__(self, message: str = "Erro interno no processamento de e-mail."):
        super().__init__(message)


class EmailDeliveryError(EmailDomainException):
    """Falha de entrega ou rejeição na API do Resend."""
    def __init__(self, message: str, status_code: int = 500, response_body: str = ""):
        self.status_code = status_code
        self.response_body = response_body
        super().__init__(f"{message} (Status: {status_code}) - Detalhes: {response_body}")


class InvalidWebhookSignatureError(EmailDomainException):
    """Assinatura Svix inválida ou ausente no webhook."""
    def __init__(self, message: str = "Assinatura do Webhook Resend/Svix inválida."):
        super().__init__(message)


class EmailTemplateNotFoundError(EmailDomainException):
    """Template Jinja2 não encontrado no sistema."""
    def __init__(self, template_name: str):
        super().__init__(f"Template de e-mail '{template_name}' não foi localizado.")