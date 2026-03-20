from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    revoked_tokens: Mapped[list["RevokedToken"]] = relationship(back_populates="user")


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    jti: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    revoked_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="revoked_tokens")


class FraudScan(Base):
    __tablename__ = "fraud_scans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    scan_type: Mapped[str] = mapped_column(String(30), default="manual")  # manual|dataset
    dataset_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    threshold: Mapped[float] = mapped_column(Float, default=50.0)

    total_rows: Mapped[int] = mapped_column(Integer, default=0)
    fraud_rows: Mapped[int] = mapped_column(Integer, default=0)

    tp: Mapped[int] = mapped_column(Integer, default=0)
    fp: Mapped[int] = mapped_column(Integer, default=0)
    tn: Mapped[int] = mapped_column(Integer, default=0)
    fn: Mapped[int] = mapped_column(Integer, default=0)

    accuracy: Mapped[float] = mapped_column(Float, default=0.0)
    precision: Mapped[float] = mapped_column(Float, default=0.0)
    recall: Mapped[float] = mapped_column(Float, default=0.0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class FraudPrediction(Base):
    __tablename__ = "fraud_predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    scan_id: Mapped[int] = mapped_column(ForeignKey("fraud_scans.id", ondelete="CASCADE"), index=True)

    dataset_transaction_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    customer_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    country: Mapped[str | None] = mapped_column(String(120), nullable=True)
    merchant_category: Mapped[str | None] = mapped_column(String(120), nullable=True)
    payment_method: Mapped[str | None] = mapped_column(String(120), nullable=True)
    device_type: Mapped[str | None] = mapped_column(String(120), nullable=True)

    # Ground truth (from dataset) if available.
    fraud_flag: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # Model output.
    status: Mapped[str] = mapped_column(String(20))  # safe|suspicious|fraud
    score: Mapped[float] = mapped_column(Float)  # 0..100
    reasoning: Mapped[str] = mapped_column(Text, default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

