import asyncio
import ipaddress
import socket
from typing import Dict, Optional
from urllib.parse import urljoin, urlparse

import httpx

_CGNAT_NETWORK = ipaddress.ip_network("100.64.0.0/10")
_THIS_NETWORK = ipaddress.ip_network("0.0.0.0/8")
_ULA_NETWORK = ipaddress.ip_network("fc00::/7")
_REDIRECT_STATUS_CODES = {301, 302, 303, 307, 308}


def _ensure_public_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address, ip_str: str) -> None:
    """Rejeita endereços IPv4/IPv6 não-públicos, mapeados, CGNAT, ULA e não especificados."""
    mapped_v4 = getattr(ip, "ipv4_mapped", None)
    if mapped_v4 is not None:
        _ensure_public_ip(mapped_v4, ip_str)

    if ip.is_unspecified:
        raise ValueError(f"Acesso a endereço IP não especificado bloqueado (Anti-SSRF): {ip_str}")

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

    if isinstance(ip, ipaddress.IPv4Address) and (ip in _CGNAT_NETWORK or ip in _THIS_NETWORK):
        raise ValueError(f"Acesso a faixa IPv4 reservada/CGNAT bloqueado (Anti-SSRF): {ip_str}")

    if isinstance(ip, ipaddress.IPv6Address) and ip in _ULA_NETWORK:
        raise ValueError(f"Acesso a faixa IPv6 ULA bloqueado (Anti-SSRF): {ip_str}")


def validate_url_safety(target_url: str) -> None:
    """
    Valida rigorosamente uma URL para mitigar ataques de Server-Side Request Forgery (SSRF).
    
    Regras de Segurança (Conforme AGENTS.md e SKILL.md):
      - Esquemas estritamente permitidos: http:// e https://.
      - Bloqueio de Loopback: 127.0.0.0/8, localhost, ::1.
      - Bloqueio de Redes Privadas RFC 1918, CGNAT (100.64.0.0/10), ULA (fc00::/7) e IPv4-mapped IPv6.
      - Bloqueio de Link-Local e Metadados de Nuvem: 169.254.169.254, 0.0.0.0/8.
    
    Lança ValueError se a URL for considerada insegura ou não puder ser resolvida.
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

    hostname_lower = hostname.strip().strip("[]").rstrip(".").lower()

    # 2. Bloqueio de strings diretas de loopback, domínios locais e metadados comuns
    if (
        hostname_lower in ("localhost", "localhost.localdomain", "0.0.0.0")
        or hostname_lower.endswith(".localhost")
        or hostname_lower.endswith(".local")
        or hostname_lower.endswith(".internal")
    ):
        raise ValueError(f"Acesso a host local proibido (Anti-SSRF): {hostname}")

    # 2b. Se já for IP literal (IPv4 ou IPv6), valida imediatamente sem depender de resolução DNS
    try:
        literal_ip = ipaddress.ip_address(hostname_lower.split("%", 1)[0])
    except ValueError:
        literal_ip = None

    if literal_ip is not None:
        _ensure_public_ip(literal_ip, hostname_lower)
        return

    # 3. Resolução DNS e verificação exaustiva dos IPs retornados (Fail-Closed)
    try:
        addr_info = socket.getaddrinfo(hostname_lower, None)
    except socket.gaierror as e:
        raise ValueError(f"Falha ao resolver hostname '{hostname}': {e}") from e

    if not addr_info:
        raise ValueError(f"Nenhum endereço IP resolvido para hostname '{hostname}'.")

    checked = False
    for item in addr_info:
        sockaddr = item[4]
        ip_str = sockaddr[0].split("%", 1)[0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            continue

        checked = True
        _ensure_public_ip(ip, ip_str)

    if not checked:
        raise ValueError(f"Nenhum endereço IP válido encontrado para hostname '{hostname}'.")


async def async_validate_url_safety(target_url: str) -> None:
    """Executa validate_url_safety em thread dedicada para não bloquear o event loop."""
    await asyncio.to_thread(validate_url_safety, target_url)


async def safe_http_get(
    client: httpx.AsyncClient,
    url: str,
    *,
    headers: Optional[Dict[str, str]] = None,
    max_redirects: int = 5,
) -> httpx.Response:
    """
    Executa GET HTTP validando Anti-SSRF salto-a-salto sem seguir redirects cegamente.
    """
    current_url = url
    for _ in range(max_redirects + 1):
        await async_validate_url_safety(current_url)
        response = await client.get(current_url, headers=headers, follow_redirects=False)

        if response.status_code not in _REDIRECT_STATUS_CODES:
            return response

        location = response.headers.get("location")
        if not location:
            return response

        current_url = urljoin(current_url, location.strip())

    raise ValueError(f"Limite máximo de {max_redirects} redirecionamentos excedido.")

