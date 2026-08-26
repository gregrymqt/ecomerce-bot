import logging
from typing import Optional, Any
import httpx

logger = logging.getLogger(__name__)

# Tenta importar Scrapling de forma resiliente com fallbacks
try:
    from scrapling import AsyncFetcher, StealthFetcher, Adaptor
    SCRAPLING_AVAILABLE = True
except ImportError:
    try:
        from scrapling import Adaptor
        SCRAPLING_AVAILABLE = True
        AsyncFetcher = None
        StealthFetcher = None
    except ImportError:
        SCRAPLING_AVAILABLE = False
        AsyncFetcher = None
        StealthFetcher = None
        Adaptor = None

class ScraplingEngineService:
    """
    Serviço de alta performance e evasão anti-bot para extração de e-commerces.
    Implementa arquitetura em cascata:
      - Tier 1: Stealth HTTP com impersonation de TLS/JA3/JA4 (50-100ms)
      - Tier 2: Stealth Browser com resolução de Cloudflare Turnstile / SPAs JS
      - Tier 3: Fallback HTTP seguro com emulação de cabeçalhos
    """

    def __init__(self, proxy_url: Optional[str] = None):
        self.proxy_url = proxy_url
        self._async_fetcher = None
        if SCRAPLING_AVAILABLE and AsyncFetcher is not None:
            try:
                self._async_fetcher = AsyncFetcher()
            except Exception as e:
                logger.warning(f"Erro ao inicializar Scrapling AsyncFetcher: {e}")

    async def fetch_tier1_http(self, url: str, impersonate: str = "chrome124", timeout: int = 15) -> Any:
        """
        Tier 1: Requisição TLS stealth ultra-rápida via curl_cffi / Scrapling.
        """
        if self._async_fetcher is not None:
            logger.info(f"⚡ [Scrapling Tier 1] Requisitando com TLS impersonate={impersonate}: {url}")
            response = await self._async_fetcher.get(
                url,
                impersonate=impersonate,
                timeout=timeout,
                proxy=self.proxy_url,
                headers={
                    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
                    "Sec-Fetch-Site": "none",
                    "Sec-Fetch-Mode": "navigate",
                    "Sec-Fetch-User": "?1",
                    "Sec-Fetch-Dest": "document",
                }
            )
            return response

        # Fallback HTTP com httpx e conversão para Adaptor se disponível
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"
            })
            if SCRAPLING_AVAILABLE and Adaptor is not None:
                return Adaptor(resp.text, url=url, status=resp.status_code)
            return resp

    async def fetch_tier2_browser(self, url: str, timeout: int = 30) -> Any:
        """
        Tier 2: Stealth Browser para contornar Cloudflare Turnstile e renderizar SPAs JS.
        """
        if SCRAPLING_AVAILABLE and StealthFetcher is not None:
            logger.info(f"🛡️ [Scrapling Tier 2] Acionando Stealth Browser para: {url}")
            try:
                stealth = StealthFetcher()
                response = await stealth.async_get(
                    url,
                    proxy=self.proxy_url,
                    solve_turnstile=True,
                    humanize_mouse=True,
                    timeout=timeout * 1000
                )
                return response
            except Exception as e:
                logger.warning(f"Falha no StealthFetcher Tier 2: {e}. Tentando fallback Tier 1.")

        return await self.fetch_tier1_http(url, timeout=timeout)

    async def fetch_page(self, url: str) -> Any:
        """
        Orquestra a busca inteligente com escalonamento automático de Tier 1 para Tier 2.
        """
        page = None
        try:
            page = await self.fetch_tier1_http(url)
            status_code = getattr(page, "status", getattr(page, "status_code", 200))
            
            # Se a resposta indicar bloqueio de anti-bot (403, 503, 429), escala para Tier 2
            if status_code in [403, 429, 503]:
                logger.info(f"🛡️ Status {status_code} detectado no Tier 1. Escalando para Tier 2 (Stealth Browser).")
                page = await self.fetch_tier2_browser(url)
        except Exception as e:
            logger.warning(f"Erro no Tier 1 ({e}). Escalando para Tier 2.")
            page = await self.fetch_tier2_browser(url)

        return page
