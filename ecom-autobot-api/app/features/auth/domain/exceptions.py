class AuthDomainError(Exception):
    """Exceção base para erros de domínio de autenticação."""
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class UserAlreadyExistsError(AuthDomainError):
    """Exceção lançada quando se tenta registrar um e-mail já existente."""
    def __init__(self, email: str):
        super().__init__(f"O e-mail '{email}' já está cadastrado no sistema.")
        self.email = email


class InvalidCredentialsError(AuthDomainError):
    """Exceção lançada em tentativas de login com credenciais incorretas."""
    def __init__(self, message: str = "Credenciais inválidas. Verifique o e-mail e a senha."):
        super().__init__(message)


class GoogleAuthError(AuthDomainError):
    """Exceção lançada quando ocorre falha na autenticação via Google OAuth 2.0."""
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


class EnterpriseLeadError(AuthDomainError):
    """Exceção lançada quando ocorre falha no registro de lead Enterprise."""
    def __init__(self, message: str):
        super().__init__(message)
