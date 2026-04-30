from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from datetime import timedelta
import logging
import re

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import GrowthEvent, ProductionSession, User, utcnow
from app.schemas import StatsCoachChatPublic, StatsCoachPublic
from app.services.ollama_client import generate_stats_chat_reply, generate_weekly_coach_note
from app.timeutil import as_utc_aware

MIN_ACCOUNT_AGE_DAYS = 14
MIN_COMPLETED_SESSIONS = 8
MIN_TOTAL_SECONDS = 3 * 60 * 60
DAILY_CHAT_LIMIT = 20
CHAT_REPLY_DEADLINE_SECONDS = 7.0
logger = logging.getLogger(__name__)
_CHAT_REPLY_EXECUTOR = ThreadPoolExecutor(max_workers=4, thread_name_prefix="stats-coach")


def _default_note() -> str:
    return (
        "You're building momentum. Keep sessions consistent, protect your strongest time window, "
        "and define one concrete output for each session."
    )


def _days_since(dt) -> int:
    now = utcnow()
    delta = now - as_utc_aware(dt)
    return max(0, int(delta.days))


def _fallback_chat_reply() -> str:
    return (
        "Observation: Your output moves fastest when session consistency and clear session targets are both locked in.\n"
        "Why it matters: Strong studio reps compound, but fuzzy session starts create friction and slow down finished tracks.\n"
        "Next actions:\n"
        "- Schedule two fixed 35-minute sessions for the next 7 days.\n"
        "- Define one concrete deliverable before each session (8 bars, one hook, or one arrangement pass).\n"
        "- End each session with a 2-line next-step note."
    )


def _looks_like_german(text: str) -> bool:
    q = (text or "").strip().lower()
    if not q:
        return False
    if any(ch in q for ch in "äöüß"):
        return True
    german_markers = (
        "ich ",
        "mir ",
        "mich ",
        "bitte",
        "wie ",
        "warum",
        "was ",
        "erklär",
        "erklaer",
        "kannst du",
        "auf deutsch",
        "sollte",
        "antwort",
        "besser",
    )
    return any(marker in q for marker in german_markers)


def _topic_hint_from_question(question: str) -> str | None:
    q = (question or "").strip().lower()
    if not q:
        return None
    topic_patterns: list[tuple[str, str]] = [
        (r"\bserum\b", "serum_sound_design"),
        (r"\b(mix|mixing|eq|compressor|kompressor|sidechain)\b", "mixing"),
        (r"\b(master|mastering|loudness|limiter)\b", "mastering"),
        (r"\b(arrangement|arrangieren|songstruktur|hook|chorus|drop)\b", "arrangement"),
        (r"\b(ableton|fl studio|logic|cubase|maschine)\b", "daw_workflow"),
    ]
    for pattern, key in topic_patterns:
        if re.search(pattern, q):
            return key
    return None


def _topic_fallback_reply(question: str, *, is_german: bool) -> str | None:
    topic = _topic_hint_from_question(question)
    if not topic:
        return None
    if topic == "serum_sound_design":
        if is_german:
            return (
                "Observation: Für Serum kommst du am schnellsten voran, wenn du mit einer klaren Patch-Struktur statt Preset-Hopping arbeitest.\n"
                "Why it matters: So baust du reproduzierbare Sounds und verlierst weniger Zeit im Sound-Design-Loop.\n"
                "Next actions:\n"
                "- Starte jedes Patch mit OSC A (Basic Shapes), Unison 4-6, Detune 0.08-0.14 als Basis.\n"
                "- Baue 1 Mod-Chain: LFO1 -> Filter Cutoff + leichter Env2 Pitch-Move (2-7 semitones) für Attack-Charakter.\n"
                "- Erstelle heute 3 eigene Serum-Patches (Bass, Lead, Pluck) und bounce je 8 Bars Audio."
            )
        return (
            "Observation: With Serum, you'll progress fastest by using a repeatable patch structure instead of preset hopping.\n"
            "Why it matters: This makes your sound design consistent and saves time during production.\n"
            "Next actions:\n"
            "- Start each patch with OSC A Basic Shapes, Unison 4-6, Detune around 0.08-0.14.\n"
            "- Build one modulation chain: LFO1 to filter cutoff plus a small Env2 pitch move (2-7 semitones).\n"
            "- Create 3 original Serum patches today (bass, lead, pluck) and bounce 8 bars for each."
        )
    if topic == "mixing":
        if is_german:
            return (
                "Observation: Dein Mix wird schneller besser, wenn du erst Balance und Low-End kontrollierst, bevor du ins Detail gehst.\n"
                "Why it matters: 80% der Mix-Qualität entstehen durch Level, EQ-Basis und sauberen Kick/Bass-Space.\n"
                "Next actions:\n"
                "- Mach einen 20-Minuten Static Mix nur mit Fadern und Pan, ohne Plugins.\n"
                "- Setze High-Pass auf nicht-Bass-Spuren und gib Kick/Bass getrennte Hauptfrequenzbereiche.\n"
                "- Begrenze dich auf 1 Hauptkompressor pro Bus und bounce danach direkt eine Referenzversion."
            )
        return (
            "Observation: Your mix improves fastest when you lock balance and low-end before micro-tweaks.\n"
            "Why it matters: Most mix quality comes from level balance, EQ fundamentals, and clear kick/bass space.\n"
            "Next actions:\n"
            "- Do a 20-minute static mix using only faders and pan.\n"
            "- High-pass non-bass tracks and separate kick/bass dominant frequency zones.\n"
            "- Use one main bus compressor per bus and bounce a reference immediately."
        )
    return None


def _tailored_fallback_chat_reply(
    *,
    user_message: str,
    wins: list[str],
    risks: list[str],
    actions: list[str],
    is_german: bool = False,
) -> str:
    q = (user_message or "").strip()
    question_hint = q if q else "your current production workflow"
    top_win = wins[0] if wins else "You already have momentum to build on."
    top_risk = risks[0] if risks else "The biggest risk is losing structure between sessions."
    top_actions = actions[:2] if actions else []
    default_actions = [
        "Define one specific output before each session starts.",
        "Lock two focused sessions into your calendar this week.",
    ]
    final_actions = (top_actions + default_actions)[:3]
    action_lines = "\n".join([f"- {line}" for line in final_actions])
    if is_german:
        return (
            f"Observation: Für '{question_hint}' ist dein größter Hebel gerade konstante Studio-Reps. {top_win}\n"
            f"Why it matters: {top_risk} Das beeinflusst direkt, wie schnell Ideen zu fertigem Output werden.\n"
            f"Next actions:\n{action_lines}"
        )
    return (
        f"Observation: For '{question_hint}', your biggest lever right now is consistent studio reps. {top_win}\n"
        f"Why it matters: {top_risk} That directly impacts how fast ideas become finished output.\n"
        f"Next actions:\n{action_lines}"
    )


def _generate_stats_chat_reply_with_deadline(prompt: str, user_id: int) -> str:
    # Provider calls are best-effort: never block the API route for too long.
    future = _CHAT_REPLY_EXECUTOR.submit(generate_stats_chat_reply, prompt)
    try:
        reply = future.result(timeout=CHAT_REPLY_DEADLINE_SECONDS)
        return reply or _fallback_chat_reply()
    except FuturesTimeoutError:
        logger.warning(
            "stats_chat_generation_timeout",
            extra={"user_id": user_id, "deadline_seconds": CHAT_REPLY_DEADLINE_SECONDS},
        )
        future.cancel()
        return _fallback_chat_reply()
    except Exception:  # noqa: BLE001
        logger.exception("stats_chat_generation_failed", extra={"user_id": user_id})
        return _fallback_chat_reply()


def build_stats_coach(db: Session, user_id: int) -> StatsCoachPublic:
    now = utcnow()
    user = db.get(User, user_id)
    if user is None:
        return StatsCoachPublic(
            eligible=False,
            reason="missing_user",
            days_active=0,
            sessions_completed=0,
            total_seconds=0,
            next_actions=["Sign in again to refresh your account data."],
            coach_note="",
        )

    completed = db.scalars(
        select(ProductionSession).where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
        )
    ).all()
    recent_14_start = now - timedelta(days=14)
    recent_7_start = now - timedelta(days=7)
    recent_14 = [s for s in completed if as_utc_aware(s.started_at) >= recent_14_start]
    recent_7 = [s for s in completed if as_utc_aware(s.started_at) >= recent_7_start]
    total_sessions = len(completed)
    total_seconds = int(sum(int(s.duration_seconds or 0) for s in completed))
    account_age_days = _days_since(user.created_at)

    if account_age_days < MIN_ACCOUNT_AGE_DAYS or total_sessions < MIN_COMPLETED_SESSIONS or total_seconds < MIN_TOTAL_SECONDS:
        missing_days = max(0, MIN_ACCOUNT_AGE_DAYS - account_age_days)
        missing_sessions = max(0, MIN_COMPLETED_SESSIONS - total_sessions)
        missing_seconds = max(0, MIN_TOTAL_SECONDS - total_seconds)
        next_actions: list[str] = []
        if missing_days > 0:
            next_actions.append(f"Keep logging activity for {missing_days} more day(s) to unlock AI coaching.")
        if missing_sessions > 0:
            next_actions.append(f"Complete {missing_sessions} more session(s) to unlock personalized analysis.")
        if missing_seconds > 0:
            mins = (missing_seconds + 59) // 60
            next_actions.append(f"Add about {mins} more focused minutes for better recommendations.")
        return StatsCoachPublic(
            eligible=False,
            reason="not_enough_data",
            days_active=account_age_days,
            sessions_completed=total_sessions,
            total_seconds=total_seconds,
            wins=[],
            risks=[],
            next_actions=next_actions,
            coach_note="",
        )

    wins: list[str] = []
    risks: list[str] = []
    next_actions: list[str] = []

    if len(recent_14) >= 6:
        wins.append("You kept strong consistency over the last two weeks.")
    if len(recent_7) >= 4:
        wins.append("This week has solid session frequency.")
    avg_duration = int(sum(int(s.duration_seconds or 0) for s in recent_14) / max(1, len(recent_14)))
    if avg_duration >= 35 * 60:
        wins.append("Your average session length supports deep work.")

    if len(recent_7) <= 1:
        risks.append("Your recent weekly cadence is low and can stall momentum.")
    if avg_duration < 20 * 60:
        risks.append("Sessions are trending short, which can reduce output quality.")

    next_actions.append("Lock two session slots in your calendar for the next 7 days.")
    if avg_duration < 30 * 60:
        next_actions.append("Target at least one 35-minute focused block this week.")
    else:
        next_actions.append("End each session with a 2-line next-step note to reduce restart friction.")

    prompt = "\n".join(
        [
            "You are an elite but practical music production coach.",
            "Write exactly 2 concise sentences (max 45 words total).",
            "No emojis. No bullet points. No generic motivational fluff.",
            f"Account age days: {account_age_days}",
            f"Completed sessions total: {total_sessions}",
            f"Completed sessions last 14 days: {len(recent_14)}",
            f"Completed sessions last 7 days: {len(recent_7)}",
            f"Average session length in last 14 days (seconds): {avg_duration}",
            f"Wins: {' | '.join(wins) if wins else 'none'}",
            f"Risks: {' | '.join(risks) if risks else 'none'}",
            f"Next actions: {' | '.join(next_actions)}",
        ]
    )
    # This endpoint is used by the Stats screen and must stay fast/reliable.
    # AI note generation is best-effort; fall back when the provider fails.
    try:
        coach_note = generate_weekly_coach_note(prompt) or _default_note()
    except Exception:  # noqa: BLE001
        logger.exception("stats_coach_note_generation_failed", extra={"user_id": user_id})
        coach_note = _default_note()

    return StatsCoachPublic(
        eligible=True,
        reason=None,
        days_active=account_age_days,
        sessions_completed=total_sessions,
        total_seconds=total_seconds,
        wins=wins[:3],
        risks=risks[:3],
        next_actions=next_actions[:3],
        coach_note=coach_note,
    )


def build_stats_chat_reply(
    db: Session,
    user_id: int,
    message: str,
    preset_key: str | None = None,
    focus_area: str | None = None,
    plan_horizon: str | None = None,
    intensity: str | None = None,
    history: list[str] | None = None,
) -> StatsCoachChatPublic:
    snapshot = build_stats_coach(db, user_id)
    prompts = [
        "What should I improve this week?",
        "How can I get more consistent sessions?",
        "What is my biggest bottleneck right now?",
        "Give me a 7-day execution plan.",
    ]
    if not snapshot.eligible:
        return StatsCoachChatPublic(
            eligible=False,
            reason=snapshot.reason,
            reply=(
                "I need more activity data before giving personalized coaching. "
                "Complete more sessions over the next days and come back."
            ),
            suggested_prompts=prompts,
        )

    day_start = utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    used_today = (
        db.scalar(
            select(func.count(GrowthEvent.id)).where(
                GrowthEvent.user_id == user_id,
                GrowthEvent.event_name == "stats_coach_chat",
                GrowthEvent.created_at >= day_start,
            )
        )
        or 0
    )
    if int(used_today) >= DAILY_CHAT_LIMIT:
        return StatsCoachChatPublic(
            eligible=True,
            reason="daily_limit",
            reply=(
                "You've reached today's coach chat limit. Review your action plan, run one focused session, "
                "and come back tomorrow for another analysis pass."
            ),
            suggested_prompts=prompts,
        )

    history_lines = [line.strip() for line in (history or []) if line and line.strip()][:2]
    is_german = _looks_like_german(message)
    language_hint = "de" if is_german else "en"
    topic_hint = _topic_hint_from_question(message) or "none"
    focus_hint = (focus_area or "none").strip()
    horizon_hint = (plan_horizon or "none").strip()
    intensity_hint = (intensity or "none").strip()
    prompt = "\n".join(
        [
            "You are an elite but practical music production coach.",
            "This is not an open-ended chatbot. The user selected a fixed coaching scope in-app.",
            "Stay strictly within the selected scope and avoid broad, generic Q&A style responses.",
            "Use only provided user stats and selected coaching scope.",
            "Respond in this exact structure:",
            "Observation: <1 sentence>",
            "Why it matters: <1 sentence>",
            "Next actions:",
            "- <short action>",
            "- <short action>",
            "- <short action>",
            "No emojis. No fluff. Keep language practical and direct.",
            "Keep the whole answer under 95 words.",
            "Each action must include either a measurable number, a time block, or an explicit deliverable.",
            f"Reply language: {'German' if language_hint == 'de' else 'English'}",
            f"Topic hint: {topic_hint}",
            f"Selected focus area: {focus_hint}",
            f"Selected plan horizon: {horizon_hint}",
            f"Selected intensity: {intensity_hint}",
            f"User question: {message.strip()}",
            f"Preset key: {preset_key or 'none'}",
            f"Recent chat: {' | '.join(history_lines) if history_lines else 'none'}",
            f"Wins: {' | '.join(snapshot.wins[:2]) if snapshot.wins else 'none'}",
            f"Risks: {' | '.join(snapshot.risks[:2]) if snapshot.risks else 'none'}",
            f"Actions: {' | '.join(snapshot.next_actions[:2]) if snapshot.next_actions else 'none'}",
            f"Coach note: {snapshot.coach_note}",
        ]
    )
    reply = _generate_stats_chat_reply_with_deadline(prompt, user_id)
    if not reply or "Observation:" not in reply or "Next actions:" not in reply:
        reply = _topic_fallback_reply(message, is_german=is_german) or _tailored_fallback_chat_reply(
            user_message=message,
            wins=snapshot.wins,
            risks=snapshot.risks,
            actions=snapshot.next_actions,
            is_german=is_german,
        )
    return StatsCoachChatPublic(
        eligible=True,
        reason=None,
        reply=reply,
        suggested_prompts=prompts,
    )
