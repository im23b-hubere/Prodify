from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import ProductionSession, User
from app.contracts.insights import SessionDetailInsightsPublic
from app.services.session_analytics_service import build_session_detail_insights

router = APIRouter()


@router.get("/item/{session_id}/insights", response_model=SessionDetailInsightsPublic)
def session_detail_insights(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SessionDetailInsightsPublic:
    session = db.get(ProductionSession, session_id)
    if session is None or session.user_id != current.id:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.stopped_at is None or session.duration_seconds is None:
        raise HTTPException(status_code=400, detail="Session must be completed")
    return build_session_detail_insights(db, current.id, session)
