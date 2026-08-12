from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import GrowthEvent, User
from app.services.friend_graph import friend_user_ids
from app.services.kpi_tracker import track_event
from app.services.push_dispatch import send_ping


def load_witness_config(
    db: Session,
    user_id: int,
    week_start: str,
    commitment_key: str,
) -> list[int]:
    rows = db.scalars(
        select(GrowthEvent)
        .where(
            GrowthEvent.user_id == user_id,
            GrowthEvent.event_name == "commitment_witness_config",
        )
        .order_by(GrowthEvent.created_at.desc())
    ).all()
    for row in rows:
        props = _event_properties(row.event_props_json)
        if props is None:
            continue
        if str(props.get("week_start")) != week_start or str(props.get("commitment_key")) != commitment_key:
            continue
        raw_witness_ids = props.get("witness_user_ids")
        if isinstance(raw_witness_ids, list):
            return _positive_unique_ids(raw_witness_ids)
    return []


def save_witness_config(
    db: Session,
    *,
    user_id: int,
    week_start: str,
    commitment_key: str,
    witness_user_ids: list[int],
) -> None:
    track_event(
        db,
        "commitment_witness_config",
        user_id=user_id,
        props={
            "week_start": week_start,
            "commitment_key": commitment_key,
            "witness_user_ids": witness_user_ids,
        },
    )
    # The caller owns the transaction boundary.


def witness_user_ids(
    db: Session,
    user_id: int,
    week_start: str,
    commitment_key: str,
    limit: int = 3,
) -> list[int]:
    available_friend_ids = friend_user_ids(db, user_id)
    configured_ids = load_witness_config(db, user_id, week_start, commitment_key)
    selection = configured_ids or available_friend_ids
    if configured_ids:
        available_friend_id_set = set(available_friend_ids)
        selection = [user_id for user_id in configured_ids if user_id in available_friend_id_set]
    return selection[: max(0, limit)]


def witness_usernames(db: Session, witness_ids: list[int]) -> list[str]:
    if not witness_ids:
        return []
    users = db.scalars(select(User).where(User.id.in_(witness_ids))).all()
    usernames_by_id = {user.id: user.username for user in users}
    return [usernames_by_id[user_id] for user_id in witness_ids if user_id in usernames_by_id]


def notify_witnesses(
    db: Session,
    *,
    actor: User,
    week_start: str,
    commitment_key: str,
    target_sessions: int,
    current_sessions: int,
    status: str,
    notify_kind: str,
    marker: str,
) -> None:
    if _notification_was_sent(
        db,
        user_id=actor.id,
        week_start=week_start,
        commitment_key=commitment_key,
        notify_kind=notify_kind,
        marker=marker,
    ):
        return

    witness_ids = witness_user_ids(db, actor.id, week_start, commitment_key, limit=3)
    title, body = _notification_copy(
        actor.username,
        target_sessions=target_sessions,
        current_sessions=current_sessions,
        notify_kind=notify_kind,
    )
    payload = _witness_payload(actor.id, week_start, commitment_key, notify_kind)
    _send_to_witnesses(db, witness_ids, title, body, payload)
    _track_witness_notification(
        db,
        actor.id,
        week_start,
        commitment_key,
        notify_kind,
        marker,
        len(witness_ids),
        status,
    )
    db.commit()


def _send_to_witnesses(
    db: Session,
    witness_ids: list[int],
    title: str,
    body: str,
    payload: dict[str, str],
) -> None:
    for witness_id in witness_ids:
        send_ping(settings, db, witness_id, title, body, data=payload)


def _witness_payload(
    actor_id: int,
    week_start: str,
    commitment_key: str,
    notify_kind: str,
) -> dict[str, str]:
    return {
        "kind": "commitment_witness",
        "notify_kind": notify_kind,
        "user_id": str(actor_id),
        "week_start": week_start,
        "commitment_key": commitment_key,
    }


def _track_witness_notification(
    db: Session,
    user_id: int,
    week_start: str,
    commitment_key: str,
    notify_kind: str,
    marker: str,
    witness_count: int,
    status: str,
) -> None:
    track_event(
        db,
        "commitment_witness_notified",
        user_id=user_id,
        props={
            "week_start": week_start,
            "commitment_key": commitment_key,
            "notify_kind": notify_kind,
            "marker": marker,
            "witness_count": witness_count,
            "status": status,
        },
    )


def _event_properties(raw_properties: str | None) -> dict[str, object] | None:
    try:
        properties = json.loads(raw_properties or "{}")
    except json.JSONDecodeError:
        return None
    return properties if isinstance(properties, dict) else None


def _positive_unique_ids(raw_ids: object) -> list[int]:
    assert isinstance(raw_ids, list)
    parsed_ids: list[int] = []
    for raw_id in raw_ids:
        try:
            user_id = int(raw_id)
        except (TypeError, ValueError):
            continue
        if user_id > 0:
            parsed_ids.append(user_id)
    return sorted(set(parsed_ids))


def _notification_was_sent(
    db: Session,
    *,
    user_id: int,
    week_start: str,
    commitment_key: str,
    notify_kind: str,
    marker: str,
) -> bool:
    rows = db.scalars(
        select(GrowthEvent).where(
            GrowthEvent.user_id == user_id,
            GrowthEvent.event_name == "commitment_witness_notified",
        )
    ).all()
    for row in rows:
        props = _event_properties(row.event_props_json)
        if props is None:
            continue
        if (
            str(props.get("week_start")) == week_start
            and str(props.get("commitment_key")) == commitment_key
            and str(props.get("notify_kind")) == notify_kind
            and str(props.get("marker")) == marker
        ):
            return True
    return False


def _notification_copy(
    username: str,
    *,
    target_sessions: int,
    current_sessions: int,
    notify_kind: str,
) -> tuple[str, str]:
    if notify_kind == "started":
        return "New public commitment", f"{username} committed to {target_sessions} sessions this week."
    if notify_kind == "completed":
        return "Commitment completed", f"{username} completed their commitment ({current_sessions}/{target_sessions})."
    if notify_kind == "behind":
        return "Commitment at risk", f"{username} is behind ({current_sessions}/{target_sessions}). Encourage them."
    return "Commitment progress", f"{username} is at {current_sessions}/{target_sessions} this week."
