from app.features.shopify.infrastructure.clients import (
    ShopifyBaseClient,
    ShopifyBulkClient,
    ShopifyInventoryClient,
    ShopifyMediaClient,
    ShopifyProductClient,
    ShopifyRateLimitError,
    is_rate_limit_error,
)


class ShopifyClient(
    ShopifyProductClient,
    ShopifyMediaClient,
    ShopifyInventoryClient,
    ShopifyBulkClient,
):
    """
    Fachada composite da infraestrutura HTTP/GraphQL para a Admin API do Shopify.
    Herda de todos os sub-clientes especializados (Produto, Mídia, Estoque, Bulk),
    garantindo 100% de retrocompatibilidade para as chamadas existentes.
    """

    pass


__all__ = [
    "ShopifyBaseClient",
    "ShopifyRateLimitError",
    "is_rate_limit_error",
    "ShopifyProductClient",
    "ShopifyMediaClient",
    "ShopifyInventoryClient",
    "ShopifyBulkClient",
    "ShopifyClient",
]
