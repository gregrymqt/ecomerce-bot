import hashlib
import hmac
import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

# Regex pré-compilado para extração rápida de ts e v1 em O(1) sem alocação de dicts temporários
TS_V1_REGEX = re.compile(r"(?:ts=(\d+))|(?:v1=([a-fA-F0-9]+))")


def verify_mercadopago_signature(
    x_signature: str,
    x_request_id: str,
    data_id: str,
    secret: str,
) -> bool:
    """
    Valida a autenticidade da notificação Webhook utilizando HMAC-SHA256
    com extração otimizada em tempo O(1) sem alocações desnecessárias na Heap.
    """
    if not x_signature or not secret:
        return False

    try:
        ts: Optional[str] = None
        v1: Optional[str] = None

        # Extração em O(1) com consumo mínimo de memória
        for match in TS_V1_REGEX.finditer(x_signature):
            if match.group(1):
                ts = match.group(1)
            elif match.group(2):
                v1 = match.group(2)

        if not ts or not v1:
            return False

        clean_data_id = str(data_id).lower() if data_id else ""

        # Formatação direta de string em alocação única
        manifest = f"id:{clean_data_id};" if clean_data_id else ""
        if x_request_id:
            manifest += f"request-id:{x_request_id};"
        manifest += f"ts:{ts};"

        computed_signature = hmac.new(
            secret.encode("utf-8"),
            manifest.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(computed_signature, v1)
    except Exception as err:
        logger.error(f"[Webhook] Erro ao validar assinatura do Mercado Pago: {err}")
        return False
