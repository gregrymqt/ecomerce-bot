class CheckoutDomainError(Exception):
    """Exceção base para erros de domínio do módulo de Checkout."""
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class OrderNotFoundError(CheckoutDomainError):
    """Exceção lançada quando um pedido não é encontrado no sistema."""
    def __init__(self, order_id: str):
        super().__init__(f"Pedido '{order_id}' não foi encontrado.")
        self.order_id = order_id


class PaymentProcessingError(CheckoutDomainError):
    """Exceção lançada quando ocorre falha no processamento do pagamento no gateway/banco."""
    def __init__(self, message: str):
        super().__init__(message)


class OrderCancellationError(CheckoutDomainError):
    """Exceção lançada quando o cancelamento do pedido falha ou é inválido para o estado atual."""
    def __init__(self, message: str = "Não foi possível cancelar o pedido. Verifique o ID e o status atual."):
        super().__init__(message)


class OrderRefundError(CheckoutDomainError):
    """Exceção lançada quando o reembolso/estorno do pedido falha."""
    def __init__(self, message: str = "Não foi possível processar o reembolso do pedido."):
        super().__init__(message)


class InvalidOrderStateError(CheckoutDomainError):
    """Exceção lançada quando tenta realizar uma operação inválida para o estado atual do pedido."""
    def __init__(self, message: str):
        super().__init__(message)
