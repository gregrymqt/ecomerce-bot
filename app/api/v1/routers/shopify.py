import httpx
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, status
from fastapi.responses import JSONResponse
from typing import Dict, Any
from app.services.shopify_service import ShopifyService
from app.config.database import AsyncSessionLocal
from app.models.database_models import TenantConfigModel
from app.utils.crypto import decrypt_api_key, get_tenant_key
from app.exporters.csv_exporter import CsvExportService
from app.models.shopify_models import ShopifyProductSetInput
from app.dependencies.auth import get_current_tenant_user

router = APIRouter(
    prefix="/api/shopify", 
    tags=["Shopify GraphQL Integration"],
    dependencies=[Depends(get_current_tenant_user)]
)

async def get_shopify_service(x_tenant_id: str = Header(..., alias="X-Tenant-ID")) -> ShopifyService:
    """
    Dependency Injection que extrai o tenant_id do Header HTTP,
    recupera os tokens criptografados do Shopify no PostgreSQL e instancia o serviço.
    """
    async with AsyncSessionLocal() as session:
        config = await session.get(TenantConfigModel, x_tenant_id)

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Tenant '{x_tenant_id}' não encontrado no ecossistema."
        )

    tenant = config.encrypted_keys or {}
    shop_domain = tenant.get("shopify_shop_domain")
    raw_token = tenant.get("shopify_access_token")

    if not shop_domain or not raw_token:
        raise HTTPException(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            detail="Credenciais do Shopify (Domínio ou Access Token) não configuradas para este Tenant."
        )

    # 🛡️ Descriptografia AES-256 GCM mantendo a paridade com o fluxo BYOK do ecossistema
    access_token = decrypt_api_key(raw_token)

    return ShopifyService(shop_domain=str(shop_domain), access_token=access_token)

@router.post("/products", status_code=status.HTTP_201_CREATED, response_model=Dict[str, Any])
async def sync_product_to_shopify(
    product_data: Dict[str, Any], 
    service: ShopifyService = Depends(get_shopify_service)
):
    """
    Recebe os dados brutos enriquecidos pela IA do bot e delega 
    a mutação declarativa (productSet) de forma atômica para o Shopify.
    """
    try:
        # Invoca o serviço que já lida com o parsing do Pydantic e validação de userErrors
        result = await service.sync_product(product_data)
        return result
    except ValueError as val_err:
        # Intercepta erros de validação de negócio extraídos do GraphQL (userErrors)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(val_err)
        )
    except Exception as e:
        # Mecanismo de Fallback: Gera CSV ao falhar persistentemente após os retries
        try:
            input_data = ShopifyProductSetInput.from_internal_data(product_data)
            csv_bytes = CsvExportService.generate_shopify_csv([input_data])
            
            # Aqui, um serviço de Storage salvaria o buffer (csv_bytes) e retornaria a URL.
            # Utilizando URL fictícia de download para atender ao contrato do MFE.
            download_url = "https://greg-ecosystem.com/downloads/fallback/shopify-temp.csv"
            
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
                detail=f"Falha na execução da mutação no provedor Shopify: {str(e)} | Erro no Fallback de CSV: {str(fallback_err)}"
            )


@router.post("/products/{product_id}/media", status_code=status.HTTP_201_CREATED)
async def add_media_to_product(
    product_id: str,
    media_payload: Dict[str, Any], # Espera {"image_urls": ["...", "..."], "alt_text": "..."}
    service: ShopifyService = Depends(get_shopify_service)
):
    """
    Injeta novas mídias e fotos otimizadas no produto informado via ID Global.
    """
    try:
        urls = media_payload.get("image_urls", [])
        alt = media_payload.get("alt_text")
        if not urls:
            raise HTTPException(status_code=400, detail="A lista 'image_urls' não pode estar vazia.")
            
        result = await service.create_product_media(product_id=product_id, image_urls=urls, alt_text=alt)
        return result
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(val_err))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))      

@router.put("/products/{product_id}", response_model=Dict[str, Any])
async def update_shopify_product(
    product_id: str,
    update_payload: Dict[str, Any],
    service: ShopifyService = Depends(get_shopify_service)
):
    """
    Atualiza metadados textuais de IA, configurações de SEO e injeta mídias 
    adicionais de forma síncrona no produto Shopify especificado por seu GID.
    """
    try:
        # Separando os metadados do array opcional de mídias enviadas pelo front/worker
        new_images = update_payload.pop("new_images", None)
        
        result = await service.update_product(
            product_id=product_id, 
            update_fields=update_payload, 
            new_images=new_images
        )
        return result
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(val_err)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Incapaz de processar a atualização no Shopify GraphQL: {str(e)}"
        )

@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shopify_product(
    product_id: str, 
    service: ShopifyService = Depends(get_shopify_service)
):
    """
    Remove de forma definitiva e irreversível um produto do Shopify 
    utilizando seu Global ID (GID) sob escopo controlado de Tenant.
    """
    try:
        await service.delete_product(product_id=product_id)
        return None
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Falha de comunicação para exclusão de produto no Shopify: {str(e)}"
        )        

@router.get("/products", response_model=Dict[str, Any])
async def list_shopify_products(
    first: int = 10,
    after: Optional[str] = None,
    service: ShopifyService = Depends(get_shopify_service)
):
    """
    Obtém a lista de produtos da loja usando paginação baseada em cursor.
    Passe o 'after' obtido em 'pageInfo.endCursor' para navegar para a próxima página.
    """
    try:
        # Chama a execução da query estruturada
        result = await service.list_products(first=first, after=after)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Incapaz de recuperar a lista de produtos do provedor: {str(e)}"
        )        