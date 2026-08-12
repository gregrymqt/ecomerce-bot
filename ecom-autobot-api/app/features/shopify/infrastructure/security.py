import base64
import hmac
import hashlib
import logging

logger = logging.getLogger(__name__)


def verify_shopify_webhook_hmac(raw_body: bytes, hmac_header: str, secret: str) -> bool:
    """
    Valida a assinatura HMAC-SHA256 (Base64) enviada pelo Shopify no header X-Shopify-Hmac-Sha256.
    
    :param raw_body: Corpo bruto da requisição HTTP (bytes).
    :param hmac_header: Valor do header X-Shopify-Hmac-Sha256 (Base64).
    :param secret: Segredo da aplicação/webhook do Shopify (SHOPIFY_WEBHOOK_SECRET).
    :return: True se a assinatura for válida; False em caso contrário.
    """
    if not hmac_header or not secret or raw_body is None:
        logger.warning("[Shopify Webhook Security] Header HMAC, segredo ou corpo ausentes para validação.")
        return False

    try:
        secret_bytes = secret.encode("utf-8") if isinstance(secret, str) else secret
        digest = hmac.new(secret_bytes, raw_body, hashlib.sha256).digest()
        computed_hmac = base64.b64encode(digest).decode("utf-8")

        # hmac.compare_digest previne ataques de tempo (timing attacks)
        is_valid = hmac.compare_digest(computed_hmac.strip(), hmac_header.strip())
        if not is_valid:
            logger.warning("[Shopify Webhook Security] Assinatura HMAC divergente do payload recebido.")
        return is_valid
    except Exception as err:
        logger.error(f"[Shopify Webhook Security] Erro ao verificar assinatura HMAC: {err}")
        return False
