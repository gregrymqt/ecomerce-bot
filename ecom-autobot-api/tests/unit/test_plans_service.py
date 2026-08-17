from unittest.mock import AsyncMock, MagicMock
import pytest

from app.features.plans.domain.entities import PlanModel
from app.features.plans.schemas import AutoRecurringCreateDTO, CreatePlanRequest, UpdatePlanRequest
from app.features.plans.services.plans_service import PlansService


@pytest.fixture
def mock_plans_repo():
    return AsyncMock()


@pytest.mark.asyncio
async def test_create_plan_success(mock_plans_repo):
    sample_model = PlanModel(
        id="plan_pro",
        external_id="plan_pro",
        reason="Plano Pro Local",
        status="active",
        auto_recurring={"transaction_amount": 99.9, "frequency": 1, "frequency_type": "months"},
    )
    mock_plans_repo.save.return_value = sample_model

    service = PlansService(repository=mock_plans_repo)
    req = CreatePlanRequest(
        reason="Plano Pro Local",
        external_id="plan_pro",
        auto_recurring=AutoRecurringCreateDTO(
            frequency=1,
            frequency_type="months",
            transaction_amount=99.9,
        ),
    )

    response = await service.create_plan(req)

    assert response.id == "plan_pro"
    assert response.reason == "Plano Pro Local"
    assert response.status == "active"
    assert response.auto_recurring["transaction_amount"] == 99.9
    mock_plans_repo.save.assert_called_once()


@pytest.mark.asyncio
async def test_list_local_plans(mock_plans_repo):
    sample_model = PlanModel(
        id="plan_free",
        external_id="plan_free",
        reason="Plano Gratuito",
        status="active",
        auto_recurring={"transaction_amount": 0.0},
    )
    mock_plans_repo.list_plans.return_value = [sample_model]

    service = PlansService(repository=mock_plans_repo)
    results = await service.list_local_plans(limit=10, offset=0)

    assert len(results) == 1
    assert results[0].id == "plan_free"
    assert results[0].reason == "Plano Gratuito"
    mock_plans_repo.list_plans.assert_called_once_with(limit=10, offset=0)


@pytest.mark.asyncio
async def test_update_plan_success(mock_plans_repo):
    existing_model = PlanModel(
        id="plan_pro",
        external_id="plan_pro",
        reason="Plano Pro",
        status="active",
        auto_recurring={"transaction_amount": 99.9},
    )
    updated_model = PlanModel(
        id="plan_pro",
        external_id="plan_pro",
        reason="Plano Pro Atualizado",
        status="active",
        auto_recurring={"transaction_amount": 149.9},
    )
    mock_plans_repo.get_by_id.return_value = existing_model
    mock_plans_repo.update.return_value = updated_model

    service = PlansService(repository=mock_plans_repo)
    req = UpdatePlanRequest(reason="Plano Pro Atualizado")

    response = await service.update_plan("plan_pro", req)

    assert response.reason == "Plano Pro Atualizado"
    mock_plans_repo.update.assert_called_once()
