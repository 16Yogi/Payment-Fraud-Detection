from __future__ import annotations

import csv
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...db.models import FraudPrediction, FraudScan
from ...db.session import get_db
from ...models.fraud import FraudScoreRequest
from ...services.fraud_service import score_transaction
from ..deps import get_current_user

router = APIRouter(prefix="/api/dataset", tags=["dataset"])

class FraudPredictionItem(BaseModel):
    dataset_transaction_id: str | None = None
    customer_id: str | None = None
    amount: float
    currency: str
    country: str | None = None
    merchant_category: str | None = None
    payment_method: str | None = None
    device_type: str | None = None
    fraud_flag: bool | None = None
    status: str
    score: float
    reasoning: str

    transaction_time_utc: str | None = None


class DatasetRunRequest(BaseModel):
    dataset_filename: Optional[str] = Field(
        default=None,
        description="CSV filename located under backend/dataset/ (e.g. sample_fraud_payment_data.csv).",
    )
    dataset_path: Optional[str] = Field(
        default=None,
        description=(
            "Optional dataset path to run. If relative, it is resolved under backend/dataset/. "
            "If absolute, it must still be inside backend/dataset/ unless you set allow_outside_dataset_dir=true."
        ),
    )
    allow_outside_dataset_dir: bool = Field(
        default=False,
        description="Allow running datasets outside backend/dataset/ (not recommended).",
    )
    fraud_threshold: float = Field(default=60.0, ge=0.0, le=100.0)
    suspicious_threshold: float = Field(default=30.0, ge=0.0, le=100.0)
    return_fraud_predictions: bool = Field(
        default=True,
        description="Whether to return predicted transactions grouped by risk (safe/suspicious/fraud).",
    )
    # UI needs separate lists for low/medium/high, so we limit per group.
    risk_predictions_limit_per_group: int = Field(
        default=20,
        ge=1,
        le=200,
        description="Max number of predicted transactions to return per risk group.",
    )


class DatasetRunResponse(BaseModel):
    scan_id: int
    dataset_name: str
    total_rows: int
    fraud_rows: int

    tp: int
    fp: int
    tn: int
    fn: int

    accuracy: float
    precision: float
    recall: float
    low_risk_predictions: list[FraudPredictionItem] = Field(default_factory=list)
    medium_risk_predictions: list[FraudPredictionItem] = Field(default_factory=list)
    high_risk_predictions: list[FraudPredictionItem] = Field(default_factory=list)


def _parse_float(value: str | None) -> Optional[float]:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _parse_int(value: str | None) -> Optional[int]:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        return None


@router.post("/run", response_model=DatasetRunResponse)
def run_dataset(
    payload: DatasetRunRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DatasetRunResponse:
    backend_dir = Path(__file__).resolve().parents[3]  # .../backend
    dataset_dir = backend_dir / "dataset"

    if not payload.dataset_filename and not payload.dataset_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide either `dataset_filename` or `dataset_path`.",
        )

    # Default: filename only if provided.
    if payload.dataset_filename:
        resolved_path = (dataset_dir / payload.dataset_filename).resolve()
        dataset_name_for_ui = payload.dataset_filename
    else:
        # Resolve user-provided path.
        raw = payload.dataset_path or ""
        candidate = Path(raw)
        if not candidate.is_absolute():
            resolved_path = (dataset_dir / raw).resolve()
        else:
            resolved_path = candidate.resolve()
        dataset_name_for_ui = Path(raw).name

    dataset_dir_resolved = dataset_dir.resolve()
    if not payload.allow_outside_dataset_dir:
        # Ensure resolved_path is within dataset_dir.
        if resolved_path != dataset_dir_resolved and dataset_dir_resolved not in resolved_path.parents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="dataset_path must be inside backend/dataset/ unless allow_outside_dataset_dir=true.",
            )

    if not resolved_path.exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Dataset file not found: {resolved_path}",
        )

    scan = FraudScan(
        user_id=current_user.id,
        scan_type="dataset",
        dataset_name=dataset_name_for_ui,
        threshold=payload.fraud_threshold,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    total_rows = 0
    fraud_rows = 0
    tp = fp = tn = fn = 0
    low_risk_predictions: list[FraudPredictionItem] = []
    medium_risk_predictions: list[FraudPredictionItem] = []
    high_risk_predictions: list[FraudPredictionItem] = []

    # Iterate line-by-line to avoid loading the entire dataset into memory.
    with resolved_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total_rows += 1

            fraud_flag_raw = row.get("Fraud_Flag")
            fraud_flag = (_parse_int(fraud_flag_raw) or 0) == 1
            if fraud_flag:
                fraud_rows += 1

            purchase_amount = _parse_float(row.get("Purchase_Amount")) or 0.0

            # Combine date + time columns into a UTC datetime (best-effort).
            dt_str = (row.get("Transaction_Date") or "").strip()
            tm_str = (row.get("Transaction_Time") or "").strip()
            tx_dt: Optional[datetime] = None
            if dt_str and tm_str:
                try:
                    tx_dt = datetime.strptime(f"{dt_str} {tm_str}", "%Y-%m-%d %H:%M:%S").replace(
                        tzinfo=timezone.utc
                    )
                except ValueError:
                    tx_dt = None

            request = FraudScoreRequest(
                amount=purchase_amount,
                currency="USD",
                country=(row.get("Location") or None),
                merchant_category=(row.get("Product_Category") or None),
                payment_method=(row.get("Payment_Method") or None),
                transaction_time_utc=tx_dt,
                device_id=(row.get("Device_Type") or None),
                ip_country=None,
            )

            prediction = score_transaction(
                request,
                fraud_threshold=payload.fraud_threshold,
                suspicious_threshold=payload.suspicious_threshold,
            )

            predicted_status = getattr(prediction.status, "value", prediction.status)
            predicted_is_fraud = predicted_status == "fraud"

            if predicted_is_fraud and fraud_flag:
                tp += 1
            elif predicted_is_fraud and not fraud_flag:
                fp += 1
            elif (not predicted_is_fraud) and (not fraud_flag):
                tn += 1
            else:
                fn += 1

            pred_row = FraudPrediction(
                scan_id=scan.id,
                dataset_transaction_id=row.get("Transaction_ID") or None,
                customer_id=row.get("Customer_ID") or None,
                amount=purchase_amount,
                currency="USD",
                country=row.get("Location") or None,
                merchant_category=row.get("Product_Category") or None,
                payment_method=row.get("Payment_Method") or None,
                device_type=row.get("Device_Type") or None,
                fraud_flag=fraud_flag,
                status=getattr(prediction.status, "value", prediction.status),
                score=prediction.score,
                reasoning=prediction.reasoning,
            )
            db.add(pred_row)

            # Collect predicted transactions for UI display (grouped by risk).
            if payload.return_fraud_predictions:
                # transaction_time_utc: our request uses `transaction_time_utc` when parsed successfully
                tx_time = tx_dt.isoformat().replace("+00:00", "Z") if tx_dt else None
                item = FraudPredictionItem(
                    dataset_transaction_id=row.get("Transaction_ID") or None,
                    customer_id=row.get("Customer_ID") or None,
                    amount=purchase_amount,
                    currency="USD",
                    country=row.get("Location") or None,
                    merchant_category=row.get("Product_Category") or None,
                    payment_method=row.get("Payment_Method") or None,
                    device_type=row.get("Device_Type") or None,
                    fraud_flag=fraud_flag,
                    status=predicted_status,
                    score=prediction.score,
                    reasoning=prediction.reasoning,
                    transaction_time_utc=tx_time,
                )

                if predicted_status == "safe":
                    if len(low_risk_predictions) < payload.risk_predictions_limit_per_group:
                        low_risk_predictions.append(item)
                elif predicted_status == "suspicious":
                    if len(medium_risk_predictions) < payload.risk_predictions_limit_per_group:
                        medium_risk_predictions.append(item)
                else:
                    if len(high_risk_predictions) < payload.risk_predictions_limit_per_group:
                        high_risk_predictions.append(item)

    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    accuracy = (tp + tn) / total_rows if total_rows else 0.0

    scan.total_rows = total_rows
    scan.fraud_rows = fraud_rows
    scan.tp = tp
    scan.fp = fp
    scan.tn = tn
    scan.fn = fn
    scan.accuracy = accuracy
    scan.precision = precision
    scan.recall = recall

    db.commit()
    db.refresh(scan)

    return DatasetRunResponse(
        scan_id=scan.id,
        dataset_name=scan.dataset_name or dataset_name_for_ui,
        total_rows=scan.total_rows,
        fraud_rows=scan.fraud_rows,
        tp=scan.tp,
        fp=scan.fp,
        tn=scan.tn,
        fn=scan.fn,
        accuracy=scan.accuracy,
        precision=scan.precision,
        recall=scan.recall,
        low_risk_predictions=low_risk_predictions,
        medium_risk_predictions=medium_risk_predictions,
        high_risk_predictions=high_risk_predictions,
    )

