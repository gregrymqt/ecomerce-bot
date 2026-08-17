class SystemDomainException(Exception):
    """Exceção base para regras de negócio, telemetria e diagnósticos do sistema."""
    def __init__(self, message: str = "Erro interno no subsistema de monitoramento e telemetria."):
        super().__init__(message)


class SystemHealthCheckError(SystemDomainException):
    """Falha durante verificação de saúde dos serviços dependentes (DB, Redis, RabbitMQ)."""
    def __init__(self, service_name: str, details: str = ""):
        super().__init__(f"Falha de saúde no serviço '{service_name}': {details}")
        self.service_name = service_name
        self.details = details


class TelemetryFetchError(SystemDomainException):
    """Falha ao consultar ou agrupar métricas de telemetria do dashboard."""
    def __init__(self, tenant_id: str, timeframe: str):
        super().__init__(f"Não foi possível obter métricas de telemetria para o tenant '{tenant_id}' (janela: {timeframe}).")
        self.tenant_id = tenant_id
        self.timeframe = timeframe


class DemoLimitExceededError(SystemDomainException):
    """Limite de requisições de demonstração excedido."""
    def __init__(self, message: str = "Limite de requisições de demonstração excedido."):
        super().__init__(message)
