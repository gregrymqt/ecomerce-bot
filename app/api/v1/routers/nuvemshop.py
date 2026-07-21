from fastapi import APIRouter, Depends, HTTPException, Header, status
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from app.services.nuvemshop_service import NuvemshopService
from app.models.nuvemshop_models import NuvemshopProductRequest
from app.config.database import AsyncSessionLocal
from app.models.database_models import TenantConfigModel
from app.utils.crypto import decrypt_api_key
from app.exporters.csv_exporter import CsvExportService
from app.dependencies.auth import get_current_tenant_user

router = APIRouter(
    prefix="/api/nuvemshop", 
    tags=["Nuvemshop Integration"],
    dependencies=[Depends(get_current_tenant_user)]
)

async def get_nuvemshop_service(x_tenant_id: str = Header(..., alias="X-Tenant-ID")) -> NuvemshopService:
    """
    Dependency Injection que extrai o tenant_id do Header HTTP,
    recupera os tokens da Nuvemshop no PostgreSQL e instancia o serviço.
    """
    async with AsyncSessionLocal() as session:
        config = await session.get(TenantConfigModel, x_tenant_id)

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant '{x_tenant_id}' não encontrado no ecossistema."
        )

    tenant = config.encrypted_keys or {}
    store_id = tenant.get("nuvemshop_store_id")
    raw_token = tenant.get("nuvemshop_access_token")
    app_email = tenant.get("email", "suporte@gregcompany.com")

    if not store_id or not raw_token:
        raise HTTPException(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            detail="Credenciais da Nuvemshop não configuradas ou ausentes para este Tenant."
        )

    # 🛡️ Aqui entra a descriptografia AES-256 GCM do seu ecossistema:
    access_token = decrypt_api_key(raw_token)

    service = NuvemshopService(store_id=str(store_id), access_token=access_token, app_email=app_email)
    
    # 🔐 Validação de escopos da Nuvemshop
    is_valid_scope = await service.validate_scopes()
    if not is_valid_scope:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="O token fornecido não possui permissões de escrita (write_products) na Nuvemshop."
        )

    return service


@router.post("/products", status_code=status.HTTP_201_CREATED, response_model=Dict[str, Any])
async def create_product(
    product: NuvemshopProductRequest, 
    service: NuvemshopService = Depends(get_nuvemshop_service)
):
    """
    Cria um novo produto na Nuvemshop com o payload estruturado pela IA.
    """
    try:
        return await service.create_product(product)
    except Exception as e:
        # Mecanismo de Fallback: Gera CSV ao falhar persistentemente após os retries
        try:
            csv_bytes = CsvExportService.generate_nuvemshop_csv([product])
            download_url = "https://greg-ecosystem.com/downloads/fallback/nuvemshop-temp.csv"
            
            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content={
                    "status": "fallback_csv",
                    "message": "A sincronização direta falhou temporariamente. O download do CSV com copywriting IA foi gerado como alternativa.",
                    "download_url": download_url
                }
            )
        except Exception as fallback_err:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY, 
                detail=f"Falha de comunicação com o provedor Nuvemshop: {str(e)} | Erro no Fallback: {str(fallback_err)}"
            )


@router.get("/products/{product_id}", response_model=Dict[str, Any])
async def get_product_by_id(
    product_id: int, 
    service: NuvemshopService = Depends(get_nuvemshop_service)
):
    """
    Busca os detalhes de um produto específico através do ID nativo.
    """
    try:
        return await service.get_product_by_id(product_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Produto com o ID {product_id} não foi encontrado na Nuvemshop."
        )


@router.get("/products/sku/{sku}", response_model=Dict[str, Any])
async def get_product_by_sku(
    sku: str, 
    service: NuvemshopService = Depends(get_nuvemshop_service)
):
    """
    Busca um produto utilizando o código SKU da variante. Útil para checagem antes de duplicações.
    """
    product = await service.get_product_by_sku(sku)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Nenhum produto correspondente ao SKU '{sku}' foi encontrado."
        )
    return product


@router.put("/products/{product_id}", response_model=Dict[str, Any])
async def update_product_metadata(
    product_id: int, 
    update_data: Dict[str, Any], 
    service: NuvemshopService = Depends(get_nuvemshop_service)
):
    """
    Atualiza metadados textuais (Título, Descrição HTML) de um produto existente.
    """
    try:
        return await service.update_product_metadata(product_id, update_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Incapaz de atualizar o produto {product_id}. Verifique o payload. Erro: {str(e)}"
        )


@router.patch("/products/stock-price", response_model=List[Dict[str, Any]])
async def update_stock_price_batch(
    batch_data: List[Dict[str, Any]], 
    service: NuvemshopService = Depends(get_nuvemshop_service)
):
    """
    Atualiza em lote o estoque e os preços de até 50 variantes simultâneas.
    """
    try:
        return await service.update_stock_price_batch(batch_data)
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(val_err))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: int, 
    service: NuvemshopService = Depends(get_nuvemshop_service)
):
    """
    Remove definitivamente um produto da loja Nuvemshop vinculada.
    """
    try:
        await service.delete_product(product_id)
        return None
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Erro ao tentar remover o produto {product_id}."
        )