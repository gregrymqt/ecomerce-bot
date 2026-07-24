import logging
from typing import Any, Dict, Optional, Type, TypeVar, Union
import httpx
from pydantic import BaseModel
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config.settings import settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


def _is_transient_error(exception: BaseException) -> bool:
    """
    Identifica erros de rede/conexão e erros HTTP com status transitórios.
    """
    if isinstance(exception, (httpx.RequestError, httpx.NetworkError, httpx.TimeoutException)):
        return True
    if isinstance(exception, httpx.HTTPStatusError):
        return exception.response.status_code in {429, 500, 502, 503, 504}
    return False


class MercadoPagoClient:
    """
    Cliente HTTP assíncrono para a API REST do Mercado Pago com injeção automática de credenciais,
    suporte a DTOs Pydantic genéricos e resiliência com retries via Tenacity.
    """

    def __init__(
        self,
        access_token: Optional[str] = None,
        base_url: str = "https://api.mercadopago.com",
        timeout: float = 30.0,
        client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        self.access_token = access_token or getattr(settings, "MERCADOPAGO_ACCESS_TOKEN", None)
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._external_client = client
        self._client: Optional[httpx.AsyncClient] = client

    @property
    def headers(self) -> Dict[str, str]:
        headers_dict = {
            "Content-Type": "application/json",
        }
        if self.access_token:
            headers_dict["Authorization"] = f"Bearer {self.access_token}"
        return headers_dict

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers=self.headers,
                timeout=self.timeout,
            )
        return self._client

    async def aclose(self) -> None:
        if self._client and not self._client.is_closed and not self._external_client:
            await self._client.aclose()
            self._client = None

    async def __aenter__(self) -> "MercadoPagoClient":
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        await self.aclose()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception(_is_transient_error),
        reraise=True,
    )
    async def _execute_request(
        self,
        method: str,
        path: str,
        **kwargs: Any,
    ) -> httpx.Response:
        client = self._get_client()
        request_headers = self.headers
        if "headers" in kwargs and kwargs["headers"]:
            request_headers = {**request_headers, **kwargs.pop("headers")}

        response = await client.request(
            method=method,
            url=path,
            headers=request_headers,
            **kwargs,
        )

        if response.status_code in {429, 500, 502, 503, 504}:
            logger.warning(
                f"[MercadoPagoClient] Status transitório {response.status_code} em {method} {path}. Disparando retry..."
            )
            response.raise_for_status()

        return response

    async def request(
        self,
        method: str,
        path: str,
        response_model: Optional[Type[T]] = None,
        **kwargs: Any,
    ) -> Union[T, Dict[str, Any]]:
        response = await self._execute_request(method, path, **kwargs)

        try:
            json_data = response.json()
        except Exception:
            json_data = {"raw_text": response.text}

        if response_model is not None:
            response.raise_for_status()
            return response_model.model_validate(json_data)

        return {
            "status": response.status_code,
            "response": json_data,
        }

    async def get(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        response_model: Optional[Type[T]] = None,
        **kwargs: Any,
    ) -> Union[T, Dict[str, Any]]:
        return await self.request(
            method="GET",
            path=path,
            response_model=response_model,
            params=params,
            **kwargs,
        )

    async def post(
        self,
        path: str,
        json_data: Optional[Dict[str, Any]] = None,
        response_model: Optional[Type[T]] = None,
        **kwargs: Any,
    ) -> Union[T, Dict[str, Any]]:
        if json_data is not None:
            kwargs["json"] = json_data
        return await self.request(
            method="POST",
            path=path,
            response_model=response_model,
            **kwargs,
        )

    async def put(
        self,
        path: str,
        json_data: Optional[Dict[str, Any]] = None,
        response_model: Optional[Type[T]] = None,
        **kwargs: Any,
    ) -> Union[T, Dict[str, Any]]:
        if json_data is not None:
            kwargs["json"] = json_data
        return await self.request(
            method="PUT",
            path=path,
            response_model=response_model,
            **kwargs,
        )

    async def delete(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        response_model: Optional[Type[T]] = None,
        **kwargs: Any,
    ) -> Union[T, Dict[str, Any]]:
        return await self.request(
            method="DELETE",
            path=path,
            response_model=response_model,
            params=params,
            **kwargs,
        )
