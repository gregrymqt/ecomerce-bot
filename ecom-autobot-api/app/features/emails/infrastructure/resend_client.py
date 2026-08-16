from typing import Any, Dict, List, Optional
import httpx
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config.settings import settings
from app.core.shared.logger import get_logger
from app.features.emails.domain.exceptions import EmailDeliveryError
from app.features.emails.schemas.resend_schemas import (
    ResendBatchResponse,
    ResendSendEmailRequest,
    ResendSendEmailResponse,
)

logger = get_logger("ResendClient")


def _is_retryable_error(exception: BaseException) -> bool:
    """
    Filtro de retentativa para o Tenacity.
    Retenta em falhas de rede/transporte e status HTTP 429 (Rate Limit) ou 5xx (Server Error).
    Erros de cliente (400, 401, 403, 422) NÃO são retentados.
    """
    if isinstance(exception, (httpx.TransportError, httpx.TimeoutException)):
        return True

    if isinstance(exception, EmailDeliveryError):
        return exception.status_code in (429, 500, 502, 503, 504)

    return False


class ResendHttpClient:
    """
    Cliente HTTP assíncrono para a API REST do Resend (DDD Infrastructure Gateway).
    Gerencia comunicação direta, serialização Pydantic v2, injeção de headers de idempotência
    e tolerância a falhas transitórias com backoff exponencial.
    """

    BASE_URL: str = "https://api.resend.com"

    def __init__(
        self,
        api_key: Optional[str] = None,
        timeout: float = 15.0,
    ) -> None:
        self.api_key = api_key or getattr(settings, "RESEND_API_KEY", None)
        self.timeout = timeout

    def _get_headers(self, idempotency_key: Optional[str] = None) -> Dict[str, str]:
        """Monta os headers de autorização e controle de idempotência para o Resend."""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "ECom-AutoBot-Api/1.0",
        }
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key.strip()
        return headers

    @retry(
        retry=retry_if_exception(_is_retryable_error),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    async def send_email(
        self,
        payload: ResendSendEmailRequest,
        idempotency_key: Optional[str] = None,
        client: Optional[httpx.AsyncClient] = None,
    ) -> ResendSendEmailResponse:
        """
        Dispara um único e-mail via endpoint POST /emails do Resend.
        Retorna o DTO estruturado com o UUID da mensagem.
        """
        if not self.api_key:
            logger.warning("[ResendClient] Chave RESEND_API_KEY não configurada. Disparo cancelado.")
            raise EmailDeliveryError("Chave de API do Resend ausente.", status_code=401)

        url = f"{self.BASE_URL}/emails"
        headers = self._get_headers(idempotency_key=idempotency_key)
        # Serializa com exclusão de campos None e respeita alias do campo "from"
        json_data = payload.model_dump(by_alias=True, exclude_none=True)

        async def _execute(c: httpx.AsyncClient) -> httpx.Response:
            return await c.post(url, headers=headers, json=json_data, timeout=self.timeout)

        try:
            if client:
                response = await _execute(client)
            else:
                async with httpx.AsyncClient() as session:
                    response = await _execute(session)

            if response.status_code in (200, 201):
                data = response.json()
                return ResendSendEmailResponse.model_validate(data)

            error_body = response.text
            logger.warning(
                f"[ResendClient] Resend API retornou HTTP {response.status_code} no envio individual: {error_body}"
            )
            raise EmailDeliveryError(
                message="Falha na resposta da API Resend",
                status_code=response.status_code,
                response_body=error_body,
            )

        except (httpx.TransportError, httpx.TimeoutException) as exc:
            logger.error(f"[ResendClient] Erro de transporte HTTP no envio individual: {exc}")
            raise

    @retry(
        retry=retry_if_exception(_is_retryable_error),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1.5, min=2, max=15),
        reraise=True,
    )
    async def send_batch(
        self,
        payloads: List[ResendSendEmailRequest],
        client: Optional[httpx.AsyncClient] = None,
    ) -> ResendBatchResponse:
        """
        Dispara um lote de até 100 e-mails em uma única requisição HTTP via POST /emails/batch.
        Garante alta vazão e reduz drasticamente o consumo de conexões e rate limit.
        """
        if not self.api_key:
            logger.warning("[ResendClient] Chave RESEND_API_KEY não configurada. Disparo em lote cancelado.")
            raise EmailDeliveryError("Chave de API do Resend ausente.", status_code=401)

        if not payloads:
            return ResendBatchResponse(data=[])

        if len(payloads) > 100:
            raise EmailDeliveryError("O Resend suporta no máximo 100 e-mails por lote.", status_code=400)

        url = f"{self.BASE_URL}/emails/batch"
        headers = self._get_headers()
        json_data = [p.model_dump(by_alias=True, exclude_none=True) for p in payloads]

        async def _execute(c: httpx.AsyncClient) -> httpx.Response:
            return await c.post(url, headers=headers, json=json_data, timeout=self.timeout + 15.0)

        try:
            if client:
                response = await _execute(client)
            else:
                async with httpx.AsyncClient() as session:
                    response = await _execute(session)

            if response.status_code in (200, 201):
                data = response.json()
                # O endpoint /emails/batch retorna {'data': [{'id': '...'}, ...]}
                return ResendBatchResponse.model_validate(data)

            error_body = response.text
            logger.warning(
                f"[ResendClient] Resend API retornou HTTP {response.status_code} no envio em lote: {error_body}"
            )
            raise EmailDeliveryError(
                message="Falha na resposta da API Resend (Batch)",
                status_code=response.status_code,
                response_body=error_body,
            )

        except (httpx.TransportError, httpx.TimeoutException) as exc:
            logger.error(f"[ResendClient] Erro de transporte HTTP no envio em lote: {exc}")
            raise


resend_client = ResendHttpClient()