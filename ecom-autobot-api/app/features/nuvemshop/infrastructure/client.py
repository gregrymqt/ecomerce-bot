import logging
from app.features.nuvemshop.infrastructure.nuvemshop_category_client import NuvemshopCategoryClient
from app.features.nuvemshop.infrastructure.nuvemshop_image_client import NuvemshopImageClient
from app.features.nuvemshop.infrastructure.nuvemshop_product_client import NuvemshopProductClient
from app.features.nuvemshop.infrastructure.nuvemshop_stock_client import NuvemshopStockClient
from app.features.nuvemshop.infrastructure.nuvemshop_webhook_client import NuvemshopWebhookClient

logger = logging.getLogger(__name__)


class NuvemshopClient(
    NuvemshopStockClient,
    NuvemshopProductClient,
    NuvemshopImageClient,
    NuvemshopCategoryClient,
    NuvemshopWebhookClient,
):
    """
    Cliente de infraestrutura HTTP/REST desacoplado para a API da Nuvemshop (Tiendanube).
    Facade Agregadora que herda dos clientes especializados por contexto de domínio
    (Stock, Product, Image, Category e Webhook), mantendo retrocompatibilidade total.
    """
    pass
