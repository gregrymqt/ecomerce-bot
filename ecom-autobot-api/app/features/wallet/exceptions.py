class InsufficientBalanceException(Exception):
    """
    Exceção lançada quando uma operação tenta consumir mais créditos do que o saldo disponível na carteira do tenant.
    """
    def __init__(self, message: str = "Saldo insuficiente para realizar esta operação."):
        self.message = message
        super().__init__(self.message)
