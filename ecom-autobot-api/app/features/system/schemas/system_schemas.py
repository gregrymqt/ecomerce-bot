from datetime import datetime
from typing import List, Optional, Union
from pydantic import BaseModel, ConfigDict, Field


class DemoRequest(BaseModel):
    urls: List[str]


class ProductStatusSummary(BaseModel):
    raw: int = 0
    processing: int = 0
    processed: int = 0
    failed: int = 0


class TokenTelemetrySchema(BaseModel):
    provider: str
    total_prompt_tokens: int = 0
    total_completion_tokens: int = 0
    total_tokens: int = 0


class RobotActivitySchema(BaseModel):
    id: Union[str, int]
    worker_type: str
    status: str
    details: Optional[str] = None
    duration_ms: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DashboardTelemetryResponse(BaseModel):
    status_summary: ProductStatusSummary
    tokens_by_provider: List[TokenTelemetrySchema]
    average_latency_ms: float = 0.0
    hours_saved: float = 0.0


class SystemHealthDetails(BaseModel):
    database: bool
    redis: bool
    rabbitmq: bool
    status: str
