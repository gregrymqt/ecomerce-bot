import unittest
import asyncio
from unittest.mock import AsyncMock, MagicMock
from app.core.shared.security import validate_url_safety
from app.core.config.redis_db import RedisCache

class TestSecurityAndSafeCache(unittest.IsolatedAsyncioTestCase):
    def test_validate_url_safety_allows_public_urls(self):
        # Domínios públicos legítimos
        valid_urls = [
            "https://www.google.com/search?q=test",
            "http://example.com/item/123",
            "https://github.com",
        ]
        for url in valid_urls:
            try:
                validate_url_safety(url)
            except Exception as e:
                self.fail(f"validate_url_safety bloqueou indevidamente URL pública '{url}': {e}")

    def test_validate_url_safety_blocks_loopback(self):
        loopback_urls = [
            "http://localhost:8000/api",
            "http://127.0.0.1:5672",
            "http://127.0.0.2:80",
            "http://[::1]/admin",
        ]
        for url in loopback_urls:
            with self.assertRaises(ValueError, msg=f"Deveria bloquear loopback: {url}"):
                validate_url_safety(url)

    def test_validate_url_safety_blocks_private_networks(self):
        private_urls = [
            "http://10.0.0.1/admin",
            "http://172.16.0.10:8080/metrics",
            "http://192.168.1.1/setup",
        ]
        for url in private_urls:
            with self.assertRaises(ValueError, msg=f"Deveria bloquear rede privada: {url}"):
                validate_url_safety(url)

    def test_validate_url_safety_blocks_cloud_metadata(self):
        metadata_urls = [
            "http://169.254.169.254/latest/meta-data",
            "http://0.0.0.0:8000",
        ]
        for url in metadata_urls:
            with self.assertRaises(ValueError, msg=f"Deveria bloquear metadados/link-local: {url}"):
                validate_url_safety(url)

    def test_validate_url_safety_blocks_invalid_schemes(self):
        invalid_schemes = [
            "ftp://ftp.example.com/file.txt",
            "file:///etc/passwd",
            "javascript:alert(1)",
            "gopher://evil.com",
        ]
        for url in invalid_schemes:
            with self.assertRaises(ValueError, msg=f"Deveria bloquear esquema inválido: {url}"):
                validate_url_safety(url)

    async def test_safecache_get_or_compute_locks_and_caches(self):
        cache = RedisCache()
        mock_client = MagicMock()
        
        # Simula cache miss na primeira tentativa e hit na segunda
        storage = {}
        async def mock_get(k):
            return storage.get(k)
        async def mock_set(k, v, ex=None):
            storage[k] = v
            return True

        mock_client.get = AsyncMock(side_effect=mock_get)
        mock_client.set = AsyncMock(side_effect=mock_set)
        cache.redis_client = mock_client

        call_count = 0
        async def heavy_computation():
            nonlocal call_count
            call_count += 1
            return "computed_data_123"

        # 1ª chamada: executa computação
        result1 = await cache.get_or_compute("test_key", heavy_computation, base_ttl=60)
        self.assertEqual(result1, "computed_data_123")
        self.assertEqual(call_count, 1)

        # 2ª chamada: retorna do cache sem recomputar
        result2 = await cache.get_or_compute("test_key", heavy_computation, base_ttl=60)
        self.assertEqual(result2, "computed_data_123")
        self.assertEqual(call_count, 1)

    async def test_idempotency_key_set_nx(self):
        cache = RedisCache()
        mock_client = MagicMock()
        
        idempotency_store = set()
        async def mock_set_nx(key, val, ex=None, nx=False):
            if key in idempotency_store:
                return None  # Redis retorna None se nx=True e a chave já existe
            idempotency_store.add(key)
            return True

        async def mock_exists(key):
            return 1 if key in idempotency_store else 0

        mock_client.set = AsyncMock(side_effect=mock_set_nx)
        mock_client.exists = AsyncMock(side_effect=mock_exists)
        cache.redis_client = mock_client

        key = "worker:idempotency:scraper:tenant-1:SKU-99"
        
        # 1ª vez: não processado
        is_processed_before = await cache.is_already_processed(key)
        self.assertFalse(is_processed_before)
        
        success = await cache.set_idempotency_key(key)
        self.assertTrue(success)

        # 2ª vez: já processado
        is_processed_after = await cache.is_already_processed(key)
        self.assertTrue(is_processed_after)

        success_dup = await cache.set_idempotency_key(key)
        self.assertFalse(success_dup)

if __name__ == "__main__":
    unittest.main()
