from __future__ import annotations

from collections import defaultdict
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import ProductionSession, SocialComment, SocialReaction, User
from app.schemas import (
    SocialCommentBody,
    SocialCommentPublic,
    SocialReactionBody,
    SocialReactionPublic,
    SocialReactionUserPublic,
)
from app.services.friend_graph import friend_user_ids


router = APIRouter(prefix="/feed")


@router.post("/{session_id}/comments", response_model=SocialCommentPublic)
def add_session_comment(
    session_id: int,
    body: SocialCommentBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    _require_visible_session(db, session_id, current.id)
    comment = SocialComment(
        target_type="session",
        target_id=session_id,
        author_id=current.id,
        body=body.body.strip(),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _comment_response(comment, current)


@router.get("/{session_id}/comments", response_model=list[SocialCommentPublic])
def list_session_comments(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    _require_visible_session(db, session_id, current.id)
    comments = db.scalars(
        select(SocialComment)
        .where(SocialComment.target_type == "session", SocialComment.target_id == session_id)
        .order_by(SocialComment.created_at.asc())
        .limit(80)
    ).all()
    authors = {
        user.id: user
        for user in db.scalars(select(User).where(User.id.in_([comment.author_id for comment in comments]))).all()
    }
    return [_comment_response(comment, authors.get(comment.author_id)) for comment in comments]


@router.post("/{session_id}/reactions", response_model=list[SocialReactionPublic])
def react_to_session(
    session_id: int,
    body: SocialReactionBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    _require_visible_session(db, session_id, current.id)
    emoji = body.emoji.strip() or "👍"
    existing = db.scalar(
        select(SocialReaction).where(
            SocialReaction.target_type == "session",
            SocialReaction.target_id == session_id,
            SocialReaction.user_id == current.id,
            SocialReaction.emoji == emoji,
        )
    )
    if existing is None:
        db.add(SocialReaction(target_type="session", target_id=session_id, user_id=current.id, emoji=emoji))
    else:
        db.delete(existing)
    db.commit()
    return _reaction_summary(db, session_id, current.id)


@router.get("/{session_id}/reactions", response_model=list[SocialReactionPublic])
def list_session_reactions(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    _require_visible_session(db, session_id, current.id)
    return _reaction_summary(db, session_id, current.id)


@router.get("/{session_id}/reactions/users", response_model=list[SocialReactionUserPublic])
def list_session_reaction_users(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    _require_visible_session(db, session_id, current.id)
    reactions = db.scalars(
        select(SocialReaction)
        .where(SocialReaction.target_type == "session", SocialReaction.target_id == session_id)
        .order_by(SocialReaction.created_at.desc())
        .limit(60)
    ).all()
    usernames = {
        user.id: user.username
        for user in db.scalars(select(User).where(User.id.in_([reaction.user_id for reaction in reactions]))).all()
    }
    return [
        SocialReactionUserPublic(
            user_id=reaction.user_id,
            username=usernames.get(reaction.user_id, "?"),
            emoji=reaction.emoji,
            created_at=reaction.created_at,
        )
        for reaction in reactions
    ]


def _require_visible_session(db: Session, session_id: int, viewer_id: int) -> ProductionSession:
    session = db.get(ProductionSession, session_id)
    if session is None or session.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Session not found")
    visible_user_ids = {viewer_id, *friend_user_ids(db, viewer_id)}
    if session.user_id not in visible_user_ids:
        raise HTTPException(status_code=403, detail="Not allowed")
    return session


def _comment_response(comment: SocialComment, author: User | None) -> SocialCommentPublic:
    return SocialCommentPublic(
        id=comment.id,
        target_type=comment.target_type,
        target_id=comment.target_id,
        author_id=comment.author_id,
        author_username=author.username if author else "?",
        author_profile_picture_url=author.profile_picture_url if author else None,
        body=comment.body,
        created_at=comment.created_at,
    )


def _reaction_summary(db: Session, session_id: int, viewer_id: int) -> list[SocialReactionPublic]:
    reactions = db.scalars(
        select(SocialReaction).where(
            SocialReaction.target_type == "session",
            SocialReaction.target_id == session_id,
        )
    ).all()
    counts_by_emoji: dict[str, int] = defaultdict(int)
    viewer_emojis: set[str] = set()
    for reaction in reactions:
        counts_by_emoji[reaction.emoji] += 1
        if reaction.user_id == viewer_id:
            viewer_emojis.add(reaction.emoji)
    return [
        SocialReactionPublic(
            target_type="session",
            target_id=session_id,
            emoji=emoji,
            count=count,
            reacted_by_me=emoji in viewer_emojis,
        )
        for emoji, count in sorted(counts_by_emoji.items(), key=lambda item: item[1], reverse=True)
    ]
