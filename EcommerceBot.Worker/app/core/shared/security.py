import ipaddress
import socket
from urllib.parse import urlparse

def validate_url_safety(target_url: str) -> None:
    """
    Valida rigorosamente uma URL para mitigar ataques de Server-Side Request Forgery (SSRF).
    
    Regras de Segurança (Conforme AGENTS.md e SKILL.md):
      - Esquemas estritamente permitidos: http:// e https://.
      - Bloqueio de Loopback: 127.0.0.0/8, localhost, ::1.
      - Bloqueio de Redes Privadas RFC 1918: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16.
      - Bloqueio de Link-Local e Metadados de Nuvem: 169.254.169.254, 0.0.0.0.
    
    Lança ValueError se a URL for considerada insegura.
    """
    if not target_url or not isinstance(target_url, str):
        raise ValueError("URL inválida ou vazia.")

    parsed = urlparse(target_url.strip())
    
    # 1. Validação de esquema
    if parsed.scheme.lower() not in ("http", "https"):
        raise ValueError(f"Esquema de URL não permitido: '{parsed.scheme}'. Apenas http e https são aceitos.")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("URL sem hostname válido.")

    hostname_lower = hostname.lower()

    # 2. Bloqueio de strings diretas de loopback e metadados comuns
    if hostname_lower in ("localhost", "localhost.localdomain", "0.0.0.0"):
        raise ValueError(f"Acesso a host local proibido (Anti-SSRF): {hostname}")

    # 3. Resolução DNS e verificação de IP
    try:
        # getaddrinfo resolve IPv4 e IPv6
        addr_info = socket.getaddrinfo(hostname, None)
    except socket.gaierror as e:
        raise ValueError(f"Falha ao resolver hostname '{hostname}': {e}") from e

    for item in addr_info:
        sockaddr = item[4]
        ip_str = sockaddr[0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            continue

        if ip.is_loopback:
            raise ValueError(f"Acesso a endereço loopback bloqueado (Anti-SSRF): {ip_str}")

        if ip.is_private:
            raise ValueError(f"Acesso a endereço IP de rede privada bloqueado (Anti-SSRF): {ip_str}")

        if ip.is_link_local:
            raise ValueError(f"Acesso a endereço link-local/metadados bloqueado (Anti-SSRF): {ip_str}")

        if ip.is_reserved:
            raise ValueError(f"Acesso a endereço IP reservado bloqueado (Anti-SSRF): {ip_str}")

        if ip.is_multicast:
            raise ValueError(f"Acesso a endereço IP multicast bloqueado (Anti-SSRF): {ip_str}")
