from app.core.config.settings import settings
from app.features.auth.schemas import (
    AuthTokenResponse,
    GoogleCallbackRequest,
    GoogleLoginUrlResponse,
    GoogleUserPayload,
)


def test_google_oauth_settings():
    assert hasattr(settings, "GOOGLE_CLIENT_ID")
    assert hasattr(settings, "GOOGLE_CLIENT_SECRET")
    assert hasattr(settings, "GOOGLE_REDIRECT_URI")
    assert isinstance(settings.GOOGLE_CLIENT_ID, str)
    assert isinstance(settings.GOOGLE_CLIENT_SECRET, str)
    assert isinstance(settings.GOOGLE_REDIRECT_URI, str)


def test_google_login_url_response_schema():
    resp = GoogleLoginUrlResponse(url="https://accounts.google.com/o/oauth2/v2/auth")
    assert resp.url == "https://accounts.google.com/o/oauth2/v2/auth"


def test_google_callback_request_schema():
    req = GoogleCallbackRequest(code="sample_code_123", state="state_abc", tenant_name="Tenant Test")
    assert req.code == "sample_code_123"
    assert req.state == "state_abc"
    assert req.tenant_name == "Tenant Test"


def test_google_user_payload_schema():
    payload = GoogleUserPayload(
        email="test@gmail.com",
        sub="google_sub_999",
        name="Test User",
        picture="https://example.com/pic.jpg",
        email_verified=True,
    )
    assert payload.email == "test@gmail.com"
    assert payload.sub == "google_sub_999"
    assert payload.name == "Test User"
    assert payload.picture == "https://example.com/pic.jpg"
    assert payload.email_verified is True


def test_auth_token_response_schema():
    token_resp = AuthTokenResponse(
        access_token="mock_token",
        token_type="bearer",
        user_id="usr_001",
        email="user@test.com",
        name="User Test",
        tenants=["tenant_a", "tenant_b"],
        tenant_id="tenant_a",
    )
    assert token_resp.access_token == "mock_token"
    assert token_resp.token_type == "bearer"
    assert token_resp.user_id == "usr_001"
    assert token_resp.tenants == ["tenant_a", "tenant_b"]
    assert token_resp.tenant_id == "tenant_a"
