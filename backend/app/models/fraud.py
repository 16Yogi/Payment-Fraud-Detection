from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class FraudStatus(str, Enum):
    safe = "safe"
    suspicious = "suspicious"
    fraud = "fraud"


class FraudScoreRequest(BaseModel):
    amount: float = Field(..., gt=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    # Accept free-form text (city/region name) or ISO codes, so dataset rows can map cleanly.
    country: Optional[str] = Field(default=None, description="Country/region (optional)")

    merchant_category: Optional[str] = Field(
        default=None, description="Free-form category name (e.g. gambling, crypto)"
    )
    payment_method: Optional[str] = Field(default=None, description="e.g. card, wallet, bank_transfer")

    transaction_time_utc: Optional[datetime] = Field(
        default=None, description="ISO datetime in UTC (optional)"
    )
    ip_country: Optional[str] = Field(default=None, description="ISO-3166 alpha-2 (optional)")
    device_id: Optional[str] = Field(default=None, description="Device identifier (optional)")


class FraudScoreResponse(BaseModel):
    status: FraudStatus
    score: float = Field(..., ge=0.0, le=100.0)
    reasoning: str = Field(default="")
