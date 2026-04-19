from app.models import ProductionSession
from app.schemas import CoachDebriefPublic


def build_session_coach_debrief(session: ProductionSession) -> CoachDebriefPublic:
    dur = int(session.duration_seconds or 0)
    minutes = round(dur / 60)
    focus = int(session.focus_score or 0)
    went_well = []
    didnt = []
    next_steps = []

    if minutes >= 45:
        went_well.append(f"You put in a deep work block ({minutes} minutes).")
    else:
        went_well.append(f"You showed up and logged {minutes} minutes of focused work.")

    if focus >= 80:
        went_well.append("Your focus score was strong; your workflow looked consistent.")
    else:
        didnt.append("Focus drifted more than ideal for progress sessions.")

    if not (session.notes or "").strip():
        didnt.append("No session note was saved, which makes iteration harder.")
    else:
        went_well.append("You captured notes, which improves next-session momentum.")

    next_steps.append("Start your next session with one concrete deliverable in the first 5 minutes.")
    next_steps.append("Keep one blocker note and resolve it before ending the next session.")
    next_steps.append("Book your next session at your best-performing time window.")
    return CoachDebriefPublic(
        session_id=session.id,
        went_well=went_well[:3],
        didnt_go_well=didnt[:3],
        next_steps=next_steps[:3],
    )
