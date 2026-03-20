from fastapi import APIRouter

from .routes.fraud import router as fraud_router
from .routes.health import router as health_router
from .routes.auth import router as auth_router
from .routes.dataset import router as dataset_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(fraud_router)
api_router.include_router(dataset_router)

