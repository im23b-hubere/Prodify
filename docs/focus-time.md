# Focus time assignment

After a session, the producer puts minutes on the focuses they touched. The sum cannot exceed the session's duration. Leftover stays unassigned and does not grow the tree.

This replaces area weights (a little / some / a lot) and the rule that the starred focus earns half the time.

## Rule

| Layer | What it is | UI |
|-------|------------|----|
| **Counted duration** | Session duration, floored at the minimum counted length and capped at 12h | Already stored |
| **Touched focuses** | Which focuses the producer marks after the session | Tiles on Session complete (unchanged tap) |
| **Assigned time** | Minutes on one focus; integer seconds under the hood | Duration wheel in a sheet |
| **Unassigned time** | Counted duration minus assigned total | Remaining bar + “Put the rest on {focus}” |
| **Area time** | Sum of assigned time in that area | Derived; no separate control |
| **Main focus** | The focus with the most assigned time | Derived; no star-as-share |

Weekly goal, streak, and XP rank still use the session as a whole. Only the skill tree reads assigned time.

## Allocation

Let `D` = counted duration. Let `A(f)` = assigned seconds on focus `f`, or unset.

1. Session too short (`D = 0`): no skill time. Hide the wheel.
2. Focuses tapped, **no** focus has assigned time: **equal split** of `D` across tapped focuses. Same as today's split when there is no main focus. This is the skip path.
3. **Any** focus has assigned time: **budget mode**. Skill time is exactly `A(f)` for each focus. Unset focuses in the tap set get `0`. `sum(A) <= D`. Unassigned `D - sum(A)` is session time, not skill time.
4. Assigning `0` to a tapped focus means “touched, no skill time”.
5. Main focus = the unique max `A(f)`. Tie → none (equal split already has no main).
6. Production sessions do not weigh areas. Area time = sum of its focuses.
7. Old sessions with no assigned seconds keep today's allocator (area weights + half to main focus) so history does not jump.

Cap for one wheel: `A(f) + unassigned` in budget mode, else `D`. Never above `D`.

## Flow

1. Stop session → Session complete hero (duration, streak).
2. **What did you work on?** Tap tiles. Intentions from start stay pre-selected.
3. Each selected row shows a duration on the right: empty (`—`) until assigned, then `12 min`.
4. Tap the duration → form sheet with a duration wheel, Cancel / Save, subtitle `0–{remaining} min`.
5. Footer: `48 min of 1h 32m assigned` and a thin fill. If remaining > 0 and at least one focus is selected, a text button **Put the rest on {name}** (the main focus if any, else the last opened).
6. Autosave the reflection as today (PATCH on change). Closing the sheet is enough; no extra confirm on the card.
7. Same card on session detail, so a later edit uses the same cap (`D` of that session).

Learning sessions still pick an area first, then focuses, then the same wheel. Mixing / Beat Making sessions skip the area chips; tapping focuses is enough.

## UI

- **List, one wheel.** Never eight pickers on screen. The sheet is `presentation: formSheet` (or `Modal` `formSheet`), Cancel (leading) / Save (trailing), like Clock.
- **Duration, not clock time.** Minutes only when `D < 60m`; hours + minutes when `D >= 60m`. 1-minute ticks. No seconds.
- **Direct.** The wheel tracks the finger 1:1; rubber-band at 0 and at the cap; light haptic per detent; reduced motion drops inertia.
- **Remaining bar.** Live while the wheel moves. Going over the cap is impossible, so the bar never exceeds 100%.
- **Empty / short / error.** Short session: tiles only, existing min-duration hint. Save error: existing retry row. No assigned times: remaining bar reads `Not assigned · splits evenly` so skippers are not punished.

Copy stays studio voice: Session, Focus, Area, Skill time. No “share”, “weight”, “block”.

## Data

`session_skill_focuses.assigned_seconds` nullable integer.

- `NULL` on every focus of a session → legacy allocator.
- Any non-null on that session → budget mode; missing values count as 0.

PATCH body (new, alongside today's fields):

```json
{
  "skill_focus_ids": ["mixing.stereo", "mixing.eq"],
  "focus_times": [
    { "skill_id": "mixing.stereo", "assigned_seconds": 720 },
    { "skill_id": "mixing.eq", "assigned_seconds": 480 }
  ]
}
```

Reject if a `skill_id` is not in `skill_focus_ids`, if any value is < 0, or if the sum exceeds counted duration. Do not send `area_weights` from new clients. Keep accepting `area_weights` and `primary_skill_focus_id` for old clients and for legacy rows.

Public session DTO adds `focus_times: { skill_id, assigned_seconds }[]`. Main focus stays a derived field on read (`primary_skill_focus_id`) so the tree and stats do not care how it was chosen.

`counted_skill_seconds` in `skill_progress_service.py` becomes: if the session has any assigned seconds → those values (already counted-capped); else existing `allocate_session_seconds` / `allocate_production_seconds`.

## Implementation slices

TDD each slice. Do not start UI before the allocator is green.

1. **Allocator** — `backend/app/services/skill_progress_service.py` (+ `mobile/features/sessions/areaWeights.ts` equivalent). Tests: short session; equal split; budget; cap; production area sum; legacy weights still work.
2. **Schema + API** — Alembic on `session_skill_focuses.assigned_seconds`; PATCH/GET; 422 on overflow. Tests in `test_session_skill_focuses.py`.
3. **Reflection payload** — `focusReflectionPayload.ts`, `SessionDto`, `useSkillFocusSync`. Autosave `focus_times`. Tests that skip path sends ids only (all null).
4. **Duration sheet** — wheel + remaining bar + put-the-rest. Session complete first; session detail reuses the same card.
5. **Retire area-weight UI** — remove a little/some/a lot and the production area time preview that is computed from weights. Area chips can stay as a filter for which focuses you see, or drop if tapping focuses is enough (prefer drop: areas follow focuses).
6. **Copy + glossary already in this plan** — `sessionComplete.focusHint*`, `areaWeight*`. Stats “where the hours went” already sums skill time; it should start matching assigned minutes without a new screen.

## Do not

- Require the bar to fill to 100%.
- Let assigned totals exceed `D` and then normalize.
- Count overlapping work twice.
- Keep the star as “this focus gets half”.
- Backfill old sessions into minutes (history stays on the old allocator).
- Show the wheel on sessions under the counted minimum.
- Commit seed-lab scripts as part of this work.

## Test plan

- 92 min mixing session, tap Stereo + EQ, assign 40 and 20 → tree +40 / +20, 32 min unassigned, Stats mixing area +60.
- Tap three focuses, assign nothing → each gets a third of `D`.
- Assign 92 of 92 on one focus → others 0 if still tapped.
- Wheel will not go past remaining; Save with 0 is allowed.
- Production session with mixing + beat-making focuses, only minutes set → no `area_weights` in PATCH; area hours follow the minutes.
- Session under minimum → no skill time, no wheel.
- Existing fixture with weights and a primary focus → same totals as before this feature.
- Edit on session detail after a day → cap is still that session's duration.
- Reduced motion: sheet still usable, no haptic.
