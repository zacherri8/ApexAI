from fastapi import APIRouter

from app.api.routes import auth, chat, health, history, metadata, predict, replay, report, strategy, telemetry


api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(metadata.router, tags=["metadata"])
api_router.include_router(history.router, tags=["history"])
api_router.include_router(telemetry.router, tags=["telemetry"])
api_router.include_router(strategy.router, tags=["strategy"])
api_router.include_router(report.router, tags=["report"])
api_router.include_router(predict.router, tags=["predict"])
api_router.include_router(chat.router, tags=["chat"])
api_router.include_router(replay.router, tags=["replay"])
