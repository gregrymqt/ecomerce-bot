import base64
import os
from unittest.mock import patch

import pytest

from app.core.config.settings import settings
from app.core.security.crypto import decrypt_api_key, encrypt_api_key


def test_encrypt_decrypt_success() -> None:
    """Valida se a descriptografia recupera exatamente a chave original (AES-256 GCM)."""
    original_key = "sk-or-v1-1234567890abcdefghijklmnopqrstuvwxyz"
    encrypted_key = encrypt_api_key(original_key)

    assert encrypted_key != original_key
    assert isinstance(encrypted_key, str)

    decrypted_key = decrypt_api_key(encrypted_key)
    assert decrypted_key == original_key


def test_different_iv_for_same_plaintext() -> None:
    """Validar que a criptografia da mesma string gera vetores de inicialização (IV) diferentes."""
    plain_text = "sk-or-v1-secret-token-to-encrypt"
    encrypted1 = encrypt_api_key(plain_text)
    encrypted2 = encrypt_api_key(plain_text)

    # Criptografias da mesma string não devem ser idênticas devido aos nonces/IVs aleatórios
    assert encrypted1 != encrypted2

    # Extração dos nonces/IVs (primeiros 12 bytes antes da codificação Base64)
    raw_data1 = base64.b64decode(encrypted1)
    raw_data2 = base64.b64decode(encrypted2)

    iv1 = raw_data1[:12]
    iv2 = raw_data2[:12]

    assert iv1 != iv2
    assert len(iv1) == 12
    assert len(iv2) == 12

    # Ambas devem descriptografar para o mesmo texto original
    assert decrypt_api_key(encrypted1) == plain_text
    assert decrypt_api_key(encrypted2) == plain_text


def test_decrypt_corrupted_data_raises_exception() -> None:
    """Validar lançamento de exceção ao tentar descriptografar dados corrompidos."""
    plain_text = "secret_data"
    encrypted = encrypt_api_key(plain_text)

    # Corromper os bytes da mensagem criptografada
    raw_bytes = bytearray(base64.b64decode(encrypted))
    raw_bytes[-1] ^= 0xFF  # Inverte o último byte da tag de autenticação
    corrupted_b64 = base64.b64encode(raw_bytes).decode("utf-8")

    with pytest.raises(ValueError, match="Falha crítica de segurança|dados corrompidos"):
        decrypt_api_key(corrupted_b64)

    # Tentar descriptografar string de tamanho insuficiente (< 12 bytes)
    short_data_b64 = base64.b64encode(b"short").decode("utf-8")
    with pytest.raises(ValueError, match="insuficientes|dados corrompidos"):
        decrypt_api_key(short_data_b64)

    # Tentar descriptografar string inválida de Base64
    with pytest.raises(ValueError):
        decrypt_api_key("!!!Not_Base64_Data!!!")


def test_invalid_master_key_raises_exception() -> None:
    """Validar lançamento de exceção ao tentar descriptografar com chave mestra inválida."""
    original_text = "api_key_secret_val"
    encrypted = encrypt_api_key(original_text)

    # Gerar uma segunda chave de 32 bytes diferente
    different_key = base64.b64encode(os.urandom(32)).decode("utf-8")

    with patch.object(settings, "AES_MASTER_KEY", different_key):
        with patch.dict(os.environ, {"AES_MASTER_KEY": different_key}):
            with pytest.raises(ValueError, match="Falha crítica de segurança|dados corrompidos"):
                decrypt_api_key(encrypted)


def test_encrypt_decrypt_empty_string() -> None:
    """Validar comportamento com string vazia."""
    assert encrypt_api_key("") == ""
    assert decrypt_api_key("") == ""


def test_missing_master_key_raises_value_error() -> None:
    """Validar erro quando a chave mestra não está configurada."""
    with patch.object(settings, "AES_MASTER_KEY", None):
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(ValueError, match="AES_MASTER_KEY não configurada"):
                encrypt_api_key("some_key")
