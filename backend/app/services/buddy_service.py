from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import BuddyRelationship, BuddyStatus, User
from app.contracts.social import BuddyStatusPublic
from app.services.social_week_service import current_week_start, session_count


def get_buddy_status(db: Session, user_id: int) -> BuddyStatusPublic:
    relationship = current_buddy_relationship(db, user_id)
    if relationship is None:
        return BuddyStatusPublic(status="none")

    buddy_user_id = (
        relationship.addressee_id if relationship.requester_id == user_id else relationship.requester_id
    )
    buddy = db.get(User, buddy_user_id)
    if relationship.status != BuddyStatus.active:
        status = "pending_outgoing" if relationship.requester_id == user_id else "pending_incoming"
        return BuddyStatusPublic(
            invite_id=relationship.id,
            status=status,
            buddy_user_id=buddy_user_id,
            buddy_username=buddy.username if buddy else None,
        )

    week_start = current_week_start()
    return BuddyStatusPublic(
        invite_id=relationship.id,
        status="active",
        buddy_user_id=buddy_user_id,
        buddy_username=buddy.username if buddy else None,
        this_week_sessions=session_count(db, user_id, week_start),
        buddy_week_sessions=session_count(db, buddy_user_id, week_start),
    )


def current_buddy_relationship(db: Session, user_id: int) -> BuddyRelationship | None:
    relationships = db.scalars(
        select(BuddyRelationship).where(
            or_(BuddyRelationship.requester_id == user_id, BuddyRelationship.addressee_id == user_id)
        )
    ).all()
    if not relationships:
        return None

    active = [relationship for relationship in relationships if relationship.status == BuddyStatus.active]
    if active:
        return max(active, key=_active_relationship_recency)

    incoming = [
        relationship
        for relationship in relationships
        if relationship.status == BuddyStatus.pending and relationship.addressee_id == user_id
    ]
    if incoming:
        return max(incoming, key=_relationship_recency)

    outgoing = [
        relationship
        for relationship in relationships
        if relationship.status == BuddyStatus.pending and relationship.requester_id == user_id
    ]
    if outgoing:
        return max(outgoing, key=_relationship_recency)

    return max(relationships, key=_relationship_recency)


def _active_relationship_recency(relationship: BuddyRelationship) -> tuple[object, int]:
    return relationship.activated_at or relationship.created_at, relationship.id


def _relationship_recency(relationship: BuddyRelationship) -> tuple[object, int]:
    return relationship.created_at, relationship.id
