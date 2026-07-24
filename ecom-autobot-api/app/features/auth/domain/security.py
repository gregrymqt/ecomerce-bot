import hashlib
import os


def hash_password(password: str) -> str:
    """Gera um hash PBKDF2-HMAC-SHA256 com salt seguro de 16 bytes."""
    salt = os.urandom(16).hex()
    hashed = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000).hex()
    return f"{salt}${hashed}"


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Verifica se a senha em texto puro coincide com o hash gravado."""
    try:
        salt, hashed = password_hash.split('$')
        check = hashlib.pbkdf2_hmac('sha256', plain_password.encode('utf-8'), salt.encode('utf-8'), 100000).hex()
        return check == hashed
    except Exception:
        return False
