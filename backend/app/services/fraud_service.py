from __future__ import annotations

from datetime import timezone

from ..models.fraud import FraudScoreRequest, FraudScoreResponse


def score_transaction(
    payload: FraudScoreRequest,
    *,
    fraud_threshold: float = 70.0,
    suspicious_threshold: float = 35.0,
) -> FraudScoreResponse:
    """
    Starter heuristic scoring. Replace with real model later.
    """
    score = 0.0
    reasons: list[str] = []

    # Amount-based risk (simple heuristic tuned for typical dataset amounts).
    if payload.amount >= 300:
        score += 0.45
        reasons.append("Very high transaction amount")
    elif payload.amount >= 250:
        score += 0.35
        reasons.append("High transaction amount")
    elif payload.amount >= 150:
        score += 0.22
        reasons.append("Medium-high transaction amount")
    elif payload.amount >= 100:
        score += 0.10
        reasons.append("Above-average transaction amount")

    # Geo-based risk.
    country = (payload.country or "").strip()
    # Only apply country-based heuristic for ISO-like values.
    # (For dataset rows we often get city names, which would otherwise always look "non-US".)
    iso = country.upper()
    if len(iso) == 2 and iso != "US":
        score += 0.12
        reasons.append(f"Non-US country: {iso}")

    # Payment category risk.
    category = (payload.merchant_category or "").strip().lower()
    if category in {"gambling", "crypto"}:
        score += 0.30
        reasons.append(f"Suspicious merchant category: {category}")

    # Night-time risk.
    if payload.transaction_time_utc is not None:
        dt = payload.transaction_time_utc
        # If a naive datetime comes in, treat it as UTC.
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        hour = dt.astimezone(timezone.utc).hour
        if hour <= 5:
            score += 0.10
            reasons.append("Transaction at late/early hours (UTC)")

    # Payment-method hints.
    method = (payload.payment_method or "").strip().lower()
    if "mobile" in method or "gift card" in method:
        score += 0.20
        reasons.append(f"Payment method risk: {payload.payment_method}")
    elif method in {"wallet", "unknown"}:
        score += 0.12
        reasons.append(f"Payment method risk: {method}")

    # Device hints.
    device = (payload.device_id or "").strip().lower()
    if "mobile" in device:
        score += 0.10
        reasons.append("Mobile device used")

    # Clamp to [0, 1].
    score = max(0.0, min(1.0, score))

    score_percent = score * 100.0

    # Map to frontend-friendly labels.
    if score_percent >= fraud_threshold:
        status = "fraud"
    elif score_percent >= suspicious_threshold:
        status = "suspicious"
    else:
        status = "safe"

    # Ensure at least one reason for observability.
    if not reasons:
        reasons = ["No strong risk signals detected"]

    return FraudScoreResponse(
        status=status, score=score_percent, reasoning="; ".join(reasons)
    )

