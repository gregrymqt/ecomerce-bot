from app.features.nuvemshop.services.nuvemshop_product_service import NuvemshopProductService


class NuvemshopService(NuvemshopProductService):
    """
    Facade de Serviço de Domínio para a Nuvemshop.
    Herda diretamente de NuvemshopProductService para manter 100% de retrocompatibilidade com o código legado.
    """
    pass
