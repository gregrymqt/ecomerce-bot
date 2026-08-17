class PlanDomainException(Exception):
    """Exceção base para regras de negócio e validações da gestão de planos de assinatura."""
    def __init__(self, message: str = "Erro interno no gerenciamento de planos."):
        super().__init__(message)


class PlanNotFoundError(PlanDomainException):
    """Plano de assinatura não localizado na base de dados ou cache local."""
    def __init__(self, plan_id: str):
        super().__init__(f"Plano com ID '{plan_id}' não foi encontrado.")
        self.plan_id = plan_id


class PlanAlreadyExistsError(PlanDomainException):
    """Plano com a mesma chave ou external_id já existente na base de dados."""
    def __init__(self, identifier: str):
        super().__init__(f"Plano com o identificador '{identifier}' já existe no sistema.")
        self.identifier = identifier


class PlanValidationError(PlanDomainException):
    """Erro de validação nas configurações de recorrência ou valores do plano."""
    pass
