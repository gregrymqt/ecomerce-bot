import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import Request, HTTPException, status

from app.core.security.rate_limiter import RedisRateLimiter, rate_limit_dependency


@pytest.mark.asyncio
async def test_redis_rate_limiter_within_limit_success():
    """
    Valida que requisições dentro do limite configurado retornam False (não limitadas).
    """
    mock_redis = AsyncMock()
    mock_redis.zremrangebyscore = AsyncMock()
    mock_redis.zcard = AsyncMock(return_value=2)  # 2 requisições anteriores < limite de 5
    
    mock_pipe = MagicMock()
    mock_pipe.zadd = MagicMock()
    mock_pipe.expire = MagicMock()
    mock_pipe.execute = AsyncMock()
    mock_redis.pipeline = MagicMock(return_value=mock_pipe)

    limiter = RedisRateLimiter(redis_client=mock_redis)
    is_limited = await limiter.is_rate_limited(key="rate_limit:test", times=5, seconds=60)

    assert is_limited is False
    mock_redis.zremrangebyscore.assert_called_once()
    mock_redis.zcard.assert_called_once_with("rate_limit:test")
    mock_pipe.execute.assert_called_once()


@pytest.mark.asyncio
async def test_redis_rate_limiter_exceeded_limit():
    """
    Valida que a (N+1)-ésima requisição retorna True (limitada) ao atingir a quantidade máxima.
    """
    mock_redis = AsyncMock()
    mock_redis.zremrangebyscore = AsyncMock()
    mock_redis.zcard = AsyncMock(return_value=5)  # 5 requisições ativas == limite de 5

    limiter = RedisRateLimiter(redis_client=mock_redis)
    is_limited = await limiter.is_rate_limited(key="rate_limit:test", times=5, seconds=60)

    assert is_limited is True
    mock_redis.zremrangebyscore.assert_called_once()
    mock_redis.zcard.assert_called_once_with("rate_limit:test")


@pytest.mark.asyncio
async def test_rate_limit_dependency_success():
    """
    Valida que o rate_limit_dependency executa sem exceção para chamadas dentro do limite.
    """
    mock_request = MagicMock(spec=Request)
    mock_request.headers = {"X-Tenant-ID": "tenant_qa_test"}
    mock_request.url.path = "/api/v1/checkout/pix"

    dep_fn = rate_limit_dependency(times=10, seconds=60)

    with patch("app.core.security.rate_limiter.RedisRateLimiter.is_rate_limited", new_callable=AsyncMock) as mock_is_limited:
        mock_is_limited.return_value = False
        await dep_fn(mock_request)
        mock_is_limited.assert_called_once_with(
            key="rate_limit:tenant:tenant_qa_test:/api/v1/checkout/pix",
            times=10,
            seconds=60
        )


@pytest.mark.asyncio
async def test_rate_limit_dependency_exceeded_raises_http_429_with_retry_after():
    """
    Valida que a N-ésima + 1 requisição dispara HTTPException com status 429 e cabeçalho Retry-After.
    """
    mock_request = MagicMock(spec=Request)
    mock_request.headers = {"X-Tenant-ID": "tenant_exceeded"}
    mock_request.url.path = "/api/v1/ai-keys/test"

    dep_fn = rate_limit_dependency(times=10, seconds=60)

    with patch("app.core.security.rate_limiter.RedisRateLimiter.is_rate_limited", new_callable=AsyncMock) as mock_is_limited:
        mock_is_limited.return_value = True

        with pytest.raises(HTTPException) as exc_info:
            await dep_fn(mock_request)

        assert exc_info.value.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert exc_info.value.detail == "Rate limit exceeded. Please try again later."
        assert exc_info.value.headers is not None
        assert exc_info.value.headers.get("Retry-After") == "60"


@pytest.mark.asyncio
async def test_rate_limit_dependency_tenant_precedence_over_ip():
    """
    Valida que a chave de limitação utiliza o Tenant-ID com precedência sobre o IP quando informado.
    """
    mock_request = MagicMock(spec=Request)
    mock_request.headers = {"X-Tenant-ID": "tenant_override"}
    mock_request.client.host = "192.168.1.100"
    mock_request.url.path = "/api/v1/products"

    dep_fn = rate_limit_dependency(times=120, seconds=60)

    with patch("app.core.security.rate_limiter.RedisRateLimiter.is_rate_limited", new_callable=AsyncMock) as mock_is_limited:
        mock_is_limited.return_value = False
        await dep_fn(mock_request)

        mock_is_limited.assert_called_once_with(
            key="rate_limit:tenant:tenant_override:/api/v1/products",
            times=120,
            seconds=60
        )


@pytest.mark.asyncio
async def test_redis_rate_limiter_graceful_fallback_when_redis_fails():
    """
    Valida que em caso de indisponibilidade do Redis, o sistema não interrompe a API e permite a requisição.
    """
    mock_redis = AsyncMock()
    mock_redis.zremrangebyscore.side_effect = Exception("Conexão Redis recusada")

    limiter = RedisRateLimiter(redis_client=mock_redis)
    is_limited = await limiter.is_rate_limited(key="rate_limit:test", times=5, seconds=60)

    assert is_limited is False
