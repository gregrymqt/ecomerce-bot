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


def verify_shopify_oauth_hmac(query_params: dict, client_secret: str) -> bool:
    """
    Valida a assinatura HMAC-SHA256 (Hexadecimal) enviada pela Shopify nos parâmetros de consulta (Query Params) OAuth.

    :param query_params: Dicionário contendo os parâmetros de consulta da requisição.
    :param client_secret: Segredo do aplicativo Shopify (SHOPIFY_CLIENT_SECRET).
    :return: True se a assinatura for válida; False em caso contrário.
    """
    if not query_params or not client_secret:
        logger.warning("[Shopify OAuth Security] Parâmetros de consulta ou segredo do cliente ausentes.")
        return False

    received_hmac = query_params.get("hmac")
    if not received_hmac:
        logger.warning("[Shopify OAuth Security] Parâmetro 'hmac' ausente na URL de callback.")
        return False

    try:
        # Exclui as chaves 'hmac' e 'signature' conforme a especificação oficial OAuth da Shopify
        filtered_params = {
            k: v for k, v in query_params.items()
            if k not in ("hmac", "signature")
        }

        # Ordena as chaves lexicograficamente e formata como key1=value1&key2=value2...
        sorted_parts = []
        for k in sorted(filtered_params.keys()):
            val = filtered_params[k]
            if isinstance(val, list):
                val_str = ",".join(str(i) for i in val)
            else:
                val_str = str(val)
            sorted_parts.append(f"{k}={val_str}")

        message_str = "&".join(sorted_parts)
        secret_bytes = client_secret.encode("utf-8") if isinstance(client_secret, str) else client_secret
        computed_hex = hmac.new(secret_bytes, message_str.encode("utf-8"), hashlib.sha256).hexdigest()

        is_valid = hmac.compare_digest(computed_hex.lower(), str(received_hmac).strip().lower())
        if not is_valid:
            logger.warning("[Shopify OAuth Security] Assinatura HMAC Hexadecimal divergente dos parâmetros OAuth.")
        return is_valid
    except Exception as err:
        logger.error(f"[Shopify OAuth Security] Erro ao verificar HMAC de autorização: {err}")
        return False

