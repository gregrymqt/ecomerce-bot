class WalletDomainException(Exception):
    """Exceção base para regras de negócio e saldo da carteira pré-paga."""
    def __init__(self, message: str = "Erro interno na carteira de créditos do tenant."):
        super().__init__(message)


class InsufficientBalanceException(WalletDomainException):
    """
    Exceção lançada quando uma operação tenta consumir mais créditos do que o saldo disponível na carteira do tenant.
    """
    def __init__(self, message: str = "Saldo insuficiente para realizar esta operação."):
        self.message = message
        super().__init__(self.message)


class WalletNotFoundError(WalletDomainException):
    """Carteira do tenant não encontrada."""
    def __init__(self, tenant_id: str):
        super().__init__(f"Carteira de créditos para o tenant '{tenant_id}' não foi encontrada.")
        self.tenant_id = tenant_id
