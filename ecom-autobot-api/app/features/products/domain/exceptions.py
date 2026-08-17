class ProductDomainException(Exception):
    """Exceção base para regras de negócio e validações do catálogo de produtos."""
    def __init__(self, message: str = "Erro interno no catálogo de produtos."):
        super().__init__(message)


class ProductNotFoundError(ProductDomainException):
    """Produto não localizado no catálogo multi-tenant."""
    def __init__(self, sku: str):
        super().__init__(f"Produto com SKU '{sku}' não foi encontrado.")
        self.sku = sku


class ProductAlreadyExistsError(ProductDomainException):
    """Produto com o mesmo SKU já existente para o tenant especificado."""
    def __init__(self, sku: str, tenant_id: str):
        super().__init__(f"Produto com SKU '{sku}' já cadastrado para a organização '{tenant_id}'.")
        self.sku = sku
        self.tenant_id = tenant_id


class ProductValidationError(ProductDomainException):
    """Erro de validação de dados do produto ou metadados de enrichment."""
    pass
