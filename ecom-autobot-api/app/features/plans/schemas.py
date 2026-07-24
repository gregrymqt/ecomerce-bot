from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field


class FreeTrialDTO(BaseModel):
    frequency: int
    frequency_type: Literal["days", "months"]


class AutoRecurringCreateDTO(BaseModel):
    frequency: int
    frequency_type: Literal["days", "months"]
    repetitions: Optional[int] = None
    billing_day: Optional[int] = Field(default=None, ge=1, le=28)
    billing_day_proportional: Optional[bool] = None
    free_trial: Optional[FreeTrialDTO] = None
    transaction_amount: float
    currency_id: str = "BRL"


class PaymentMethodItemDTO(BaseModel):
    id: str


class PaymentMethodsAllowedDTO(BaseModel):
    payment_types: Optional[List[PaymentMethodItemDTO]] = None
    payment_methods: Optional[List[PaymentMethodItemDTO]] = None


class CreatePlanRequest(BaseModel):
    reason: str
    auto_recurring: AutoRecurringCreateDTO
    payment_methods_allowed: Optional[PaymentMethodsAllowedDTO] = None
    back_url: Optional[str] = None


class AutoRecurringUpdateDTO(BaseModel):
    frequency: Optional[int] = None
    frequency_type: Optional[Literal["days", "months"]] = None
    repetitions: Optional[int] = None
    billing_day: Optional[int] = Field(default=None, ge=1, le=28)
    billing_day_proportional: Optional[bool] = None
    free_trial: Optional[FreeTrialDTO] = None
    transaction_amount: Optional[float] = None
    currency_id: Optional[str] = None


class UpdatePlanRequest(BaseModel):
    reason: Optional[str] = None
    auto_recurring: Optional[AutoRecurringUpdateDTO] = None
    payment_methods_allowed: Optional[PaymentMethodsAllowedDTO] = None
    back_url: Optional[str] = None
    status: Optional[Literal["active", "canceled"]] = None


class PlanResponse(BaseModel):
    id: str
    application_id: Optional[Union[int, str]] = None
    collector_id: Optional[Union[int, str]] = None
    reason: str
    auto_recurring: Dict[str, Any]
    payment_methods_allowed: Optional[Dict[str, Any]] = None
    back_url: Optional[str] = None
    external_reference: Optional[Union[int, str]] = None
    init_point: Optional[str] = None
    date_created: Optional[str] = None
    last_modified: Optional[str] = None
    status: str
    subscribed: Optional[int] = None


class SearchPlansQueryParams(BaseModel):
    status: Optional[str] = None
    q: Optional[str] = None
    sort: Optional[str] = None
    criteria: Optional[str] = None
    offset: Optional[int] = Field(default=0, ge=0)
    limit: Optional[int] = Field(default=20, ge=1, le=100)


class PagingDTO(BaseModel):
    offset: int
    limit: int
    total: int


class PlanSearchResponse(BaseModel):
    paging: PagingDTO
    results: List[PlanResponse] = Field(default_factory=list)
