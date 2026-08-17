class SettingsDomainException(Exception):
    """Exceção base para regras de negócio e validações de configurações do tenant."""
    def __init__(self, message: str = "Erro interno nas configurações do tenant."):
        super().__init__(message)


class SettingsNotFoundError(SettingsDomainException):
    """Configurações do tenant não localizadas."""
    def __init__(self, tenant_id: str):
        super().__init__(f"Configurações para o tenant '{tenant_id}' não foram encontradas.")
        self.tenant_id = tenant_id


class SettingsValidationError(SettingsDomainException):
    """Erro de validação nos campos de configurações (IA, Precificação ou Perfil)."""
    pass
