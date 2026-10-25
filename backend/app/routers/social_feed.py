from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.contracts.social import (
    SocialCommentBody,
    SocialCommentPublic,
    SocialReactionBody,
    SocialReactionPublic,
    SocialReactionUserPublic,
)
from app.services.social_feed_service import (
    FeedAccessDeniedError,
    FeedCommentNotFoundError,
    FeedSessionNotFoundError,
    add_session_comment as create_comment,
    delete_session_comment as remove_comment,
    list_session_comments as get_comments,
    list_session_reaction_users as get_reaction_users,
    list_session_reactions as get_reactions,
    toggle_session_reaction,
)


router = APIRouter(prefix="/feed")


@router.post("/{session_id}/comments", response_model=SocialCommentPublic)
def add_session_comment(
    session_id: int,
    body: SocialCommentBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return _translate_feed_errors(create_comment, db, session_id, current, body.body)


@router.delete("/{session_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session_comment(
    session_id: int,
    comment_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    _translate_feed_errors(remove_comment, db, session_id, comment_id, current.id)


@router.get("/{session_id}/comments", response_model=list[SocialCommentPublic])
def list_session_comments(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return _translate_feed_errors(get_comments, db, session_id, current.id)


@router.post("/{session_id}/reactions", response_model=list[SocialReactionPublic])
def react_to_session(
    session_id: int,
    body: SocialReactionBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return _translate_feed_errors(
        toggle_session_reaction,
        db,
        session_id,
        current.id,
        body.emoji,
    )


@router.get("/{session_id}/reactions", response_model=list[SocialReactionPublic])
def list_session_reactions(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return _translate_feed_errors(get_reactions, db, session_id, current.id)


@router.get("/{session_id}/reactions/users", response_model=list[SocialReactionUserPublic])
def list_session_reaction_users(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return _translate_feed_errors(get_reaction_users, db, session_id, current.id)


def _translate_feed_errors(operation, *args):
    try:
        return operation(*args)
    except FeedSessionNotFoundError as error:
        raise HTTPException(status_code=404, detail="Session not found") from error
    except FeedCommentNotFoundError as error:
        raise HTTPException(status_code=404, detail="Comment not found") from error
    except FeedAccessDeniedError as error:
        raise HTTPException(status_code=403, detail="Not allowed") from error
