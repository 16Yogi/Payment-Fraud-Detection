from fastapi import APIRouter, Depends

from ...models.fraud import FraudScoreRequest, FraudScoreResponse
from ...services.fraud_service import score_transaction
from ...db.models import FraudPrediction, FraudScan
from ...db.session import get_db
from ..deps import get_current_user

router = APIRouter(tags=["fraud"])


@router.post("/api/fraud/score", response_model=FraudScoreResponse)
def fraud_score(
    payload: FraudScoreRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
) -> FraudScoreResponse:
    """
    Return a risk score for a payment transaction (starter heuristic).
    """
    scan = FraudScan(user_id=current_user.id, scan_type="manual", dataset_name=None, threshold=70.0)
    scan.total_rows = 1
    scan.fraud_rows = 1 if payload.amount and payload.amount > 0 else 0
    db.add(scan)
    db.commit()
    db.refresh(scan)

    prediction = score_transaction(payload)

    predicted_is_fraud = getattr(prediction.status, "value", prediction.status) == "fraud"
    pred = FraudPrediction(
        scan_id=scan.id,
        dataset_transaction_id=None,
        customer_id=None,
        amount=payload.amount,
        currency=payload.currency,
        country=payload.country,
        merchant_category=payload.merchant_category,
        payment_method=payload.payment_method,
        device_type=payload.device_id,
        fraud_flag=None,
        status=getattr(prediction.status, "value", prediction.status),
        score=prediction.score,
        reasoning=prediction.reasoning,
    )
    db.add(pred)

    scan.fraud_rows = 1 if predicted_is_fraud else 0
    scan.tp = 0
    scan.fp = 0
    scan.tn = 0
    scan.fn = 0
    scan.accuracy = 0.0
    scan.precision = 0.0
    scan.recall = 0.0
    db.commit()

    return prediction

