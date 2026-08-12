from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.contracts.social import (
    SocialCommentPublic,
    SocialReactionPublic,
    SocialReactionUserPublic,
)
from app.models import ProductionSession, SocialComment, SocialReaction, User
from app.services.friend_graph import friend_user_ids


class FeedSessionNotFoundError(ValueError):
    pass


class FeedAccessDeniedError(ValueError):
    pass


def add_session_comment(
    db: Session,
    session_id: int,
    author: User,
    body: str,
) -> SocialCommentPublic:
    _require_visible_session(db, session_id, author.id)
    comment = SocialComment(
        target_type="session",
        target_id=session_id,
        author_id=author.id,
        body=body.strip(),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _comment_response(comment, author)


def list_session_comments(
    db: Session,
    session_id: int,
    viewer_id: int,
) -> list[SocialCommentPublic]:
    _require_visible_session(db, session_id, viewer_id)
    comments = db.scalars(
        select(SocialComment)
        .where(SocialComment.target_type == "session", SocialComment.target_id == session_id)
        .order_by(SocialComment.created_at.asc())
        .limit(80)
    ).all()
    authors = {
        user.id: user
        for user in db.scalars(
            select(User).where(User.id.in_([comment.author_id for comment in comments]))
        ).all()
    }
    return [_comment_response(comment, authors.get(comment.author_id)) for comment in comments]


def toggle_session_reaction(
    db: Session,
    session_id: int,
    user_id: int,
    emoji: str,
) -> list[SocialReactionPublic]:
    _require_visible_session(db, session_id, user_id)
    normalized_emoji = emoji.strip() or "👍"
    existing = db.scalar(
        select(SocialReaction).where(
            SocialReaction.target_type == "session",
            SocialReaction.target_id == session_id,
            SocialReaction.user_id == user_id,
            SocialReaction.emoji == normalized_emoji,
        )
    )
    if existing is None:
        db.add(
            SocialReaction(
                target_type="session",
                target_id=session_id,
                user_id=user_id,
                emoji=normalized_emoji,
            )
        )
    else:
        db.delete(existing)
    db.commit()
    return _reaction_summary(db, session_id, user_id)


def list_session_reactions(
    db: Session,
    session_id: int,
    viewer_id: int,
) -> list[SocialReactionPublic]:
    _require_visible_session(db, session_id, viewer_id)
    return _reaction_summary(db, session_id, viewer_id)


def list_session_reaction_users(
    db: Session,
    session_id: int,
    viewer_id: int,
) -> list[SocialReactionUserPublic]:
    _require_visible_session(db, session_id, viewer_id)
    reactions = db.scalars(
        select(SocialReaction)
        .where(SocialReaction.target_type == "session", SocialReaction.target_id == session_id)
        .order_by(SocialReaction.created_at.desc())
        .limit(60)
    ).all()
    usernames = {
        user.id: user.username
        for user in db.scalars(
            select(User).where(User.id.in_([reaction.user_id for reaction in reactions]))
        ).all()
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


def _require_visible_session(db: Session, session_id: int, viewer_id: int) -> None:
    session = db.get(ProductionSession, session_id)
    if session is None or session.deleted_at is not None:
        raise FeedSessionNotFoundError
    visible_user_ids = {viewer_id, *friend_user_ids(db, viewer_id)}
    if session.user_id not in visible_user_ids:
        raise FeedAccessDeniedError


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


def _reaction_summary(
    db: Session,
    session_id: int,
    viewer_id: int,
) -> list[SocialReactionPublic]:
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
        for emoji, count in sorted(
            counts_by_emoji.items(),
            key=lambda item: item[1],
            reverse=True,
        )
    ]
