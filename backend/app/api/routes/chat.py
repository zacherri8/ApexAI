from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.models import User
from app.db.repository import F1Repository
from app.db.session import get_db
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.chat_service import ChatService


router = APIRouter()
service = ChatService()


@router.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatResponse:
    response = service.answer(db, payload.question, payload.year)
    F1Repository(db).save_activity(
        user_id=current_user.id,
        activity_type="chat",
        title=f"Chat - {payload.question[:60]}",
        summary=response.answer,
        payload={
            "request": payload.model_dump(),
            "response": response.model_dump(),
        },
    )
    return response
