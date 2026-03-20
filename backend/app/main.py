import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.router import api_router
from .db.models import Base
from .db.session import engine


def _parse_origins(raw: str) -> list[str]:
    raw = (raw or "").strip()
    if not raw or raw == "*":
        return ["*"]
    return [o.strip() for o in raw.split(",") if o.strip()]


app = FastAPI(title="Online Pyment Fraud Detation", version="0.1.0")

cors_origins = _parse_origins(os.getenv("CORS_ALLOW_ORIGINS", "*"))
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.on_event("startup")
def on_startup() -> None:
    # Create SQLite tables automatically on first run.
    Base.metadata.create_all(bind=engine)


@app.get("/")
def root() -> dict:
    return {"name": app.title, "status": "running"}

