from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.features.auth.domain.enterprise_lead_model import EnterpriseLeadModel
from app.features.auth.schemas import EnterpriseLeadRequest, EnterpriseLeadResponse
from app.features.auth.services.enterprise_lead_service import EnterpriseLeadService
from app.main import app


def test_enterprise_lead_schema_validation():
    """
    Testa a validação dos campos do DTO EnterpriseLeadRequest.
    """
    valid = EnterpriseLeadRequest(
        email="diretor@grandeempresa.com",
        company_name="Empresa Teste S/A",
        team_size="50+",
        phone="+5511999999999",
        notes="Integração via Okta",
    )
    assert valid.email == "diretor@grandeempresa.com"
    assert valid.company_name == "Empresa Teste S/A"
    assert valid.team_size == "50+"

    with pytest.raises(ValidationError):
        EnterpriseLeadRequest(email="email_invalido", company_name="Empresa")


@pytest.mark.asyncio
async def test_enterprise_lead_service_registration():
    """
    Testa o método register_lead da camada de serviço EnterpriseLeadService.
    """
    mock_repo = AsyncMock()
    created_lead = EnterpriseLeadModel(
        id="lead_test_uuid_123",
        email="suporte@corporativo.com",
        company_name="Corporativo Loja",
        team_size="11-50",
    )
    mock_repo.create_lead.return_value = created_lead

    service = EnterpriseLeadService(lead_repo=mock_repo)
    payload = EnterpriseLeadRequest(
        email="suporte@corporativo.com",
        company_name="Corporativo Loja",
        team_size="11-50",
    )

    with patch.object(service, "_send_discord_notification", new_callable=AsyncMock) as mock_notif:
        resp = await service.register_lead(payload=payload, ip_address="127.0.0.1")

        assert isinstance(resp, EnterpriseLeadResponse)
        assert resp.id == "lead_test_uuid_123"
        assert resp.email == "suporte@corporativo.com"
        assert resp.company_name == "Corporativo Loja"
        mock_notif.assert_called_once()


@pytest.mark.asyncio
async def test_enterprise_lead_endpoint():
    """
    Testa o endpoint REST POST /api/v1/auth/sso-enterprise/lead.
    """
    payload = {
        "email": "gestor@superloja.com.br",
        "company_name": "Super Loja Varejo",
        "team_size": "50+",
        "phone": "11988887777",
        "notes": "Desejamos atendimento corporativo",
    }

    mock_lead_entity = EnterpriseLeadModel(
        id="lead_rest_999",
        email="gestor@superloja.com.br",
        company_name="Super Loja Varejo",
    )

    with patch(
        "app.features.auth.repositories.enterprise_lead_repository.EnterpriseLeadRepository.create_lead",
        new_callable=AsyncMock,
    ) as mock_create:
        mock_create.return_value = mock_lead_entity

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/v1/auth/sso-enterprise/lead", json=payload)

            assert response.status_code == 201
            data = response.json()
            assert data["id"] == "lead_rest_999"
            assert data["email"] == "gestor@superloja.com.br"
            assert data["company_name"] == "Super Loja Varejo"
            assert "solicitação corporativa registrada" in data["message"].lower()
