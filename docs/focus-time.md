# Credit the session

Stop → a short list of what you worked on → spin minutes onto each row. That is the whole reflection.

No hints, no star, no a little/some/a lot, no full pass, no catalog of eight tiles with descriptions. The dopamine is the number ticking onto a named focus, not copy.

Allocator and PATCH from Slices 1–2 stay. This document replaces the old complete-card plan.

## Why the current card fails

Session complete asks the producer to **fill out a form**: eyebrow, two titles, a sentence of rules, area chips, weights, stars, full pass, progress bars, a skill-tree link. That is homework. They already finished the work. This screen should feel like locking in a take.

## Feel

Fast, professional, a little like logging a set. One decision: **what did I touch?** Then the minutes are already there. The wheel is only if EQ was more than Stereo.

Gamification is motion and numbers, not slogans:

- The minutes on the row are large and jump with the wheel (1:1, same frame as the finger).
- Light haptic per minute detent; a slightly heavier tick when a focus levels up.
- If this session pushed a focus over a level, a small `Lvl 2` appears on that row after the wheel commits. That is the hit.
- Streak and duration stay on the hero above. This card does not repeat XP, quest copy, or emoji.

Reduced motion: no inertia on the wheel, no row pulse; numbers still update.

## Screen

After the existing complete hero (duration, streak):

```
Worked on
────────────────────────────────
  EQ                         46 min
  Stereo                     46 min
  + Add
```

That is the card. No subtitle. No footnote. Save error stays the existing retry row, only when a PATCH fails.

| Piece | What it is |
|-------|------------|
| **List** | Only the focuses they picked. Short name (`EQ`), not the essay. Intentions from start are already on the list. |
| **Minutes** | Always a number, never `—`. Adding a focus even-splits counted duration `D` across the list so the session is credited immediately. |
| **Wheel** | Tap a row → Clock-style duration sheet. One wheel. Cancel / Save. Live minutes on the row while it spins. |
| **Add** | Sheet of the remaining focuses, short names, grouped by area if the session type has more than one. Tap to add, sheet stays open for a second add, swipe down to close. |
| **Remove** | Minus on the row. Last row removed → list empty → no skill time. |

No remaining-bar lecture. The list always spends all of `D`. Turning one wheel **rebalances the others** so the sum stays `D`. One focus: the wheel is `0…D` (turning below `D` is the only way leftover exists, and we do not offer it — one focus is `D`).

Short session (`D = 0`): hide this card. Hero + min-duration hint already exist.

## Wheel

iOS Clock alarm duration, not a clock time.

- Slides up from the bottom and occupies half the screen. Cancel / Save in Prodify orange.
- Title = focus short name. No subtitle of rules.
- Minutes only when `D < 60m`; hours + minutes when `D >= 60m`. 1-minute ticks. No seconds.
- Finger and value move together. Rubber-band at 0 and at the cap. Cap for this row = `D` minus the other rows’ current minutes (so this row can take everything).
- Save commits and autosaves. Cancel drops the live preview.

## What goes away on this card

- Star / main-focus as a share
- A little / some / a lot, production area time preview
- Full pass
- `focusHint*` sentences
- Tile descriptions, covers, skill-progress bars on every tile
- “View skill tree” from this card (the tab exists)
- Learning area as a separate homework step: Add is grouped by area instead

Learning still needs an area to browse in Add. Mixing / Beat Making Add is a flat short list. Production Add is short names under area headers, no weights.

## Allocation (unchanged engine)

`D` = counted duration (min floor, 12h cap).

The **new client always sends a full assignment** once the list is non-empty: `sum(A) = D`. Empty list → ids `[]`, omit `focus_times` → no skill time.

Even split is the default fill when the list changes (add/remove), then PATCH `focus_times`. Spinning one row rebalances the rest (`remainder / n-1`), then PATCH. No skip-with-nulls from this UI.

Old rows with `NULL` assigned seconds keep the legacy allocator (weights + half to star) so history does not jump.

Main focus = unique max `A(f)` on the server. The client does not show a star.

Area time = sum of its focuses. No separate control.

Weekly goal, streak, XP rank still use the session as a whole.

## Copy

Almost none. Studio voice if a string is required:

| Surface | Copy |
|---------|------|
| Card title | `Worked on` |
| Add | `Add` |
| Empty list | nothing (the Add row is the empty state) |
| Wheel | Cancel / Save |
| Level pip | `Lvl {{level}}` |
| Save error | existing retry |

No “share”, “weight”, “block”, “assign”, “remaining”, “splits evenly”.

## Flow

1. Stop. Hero lands (duration, streak).
2. If they planned a focus, it is already a row with `D` (or even split if two). If not, the card is title + Add.
3. Add EQ → row `EQ  1h 32m`. Add Stereo → both show `46 min`. Tree already gets the time.
4. They want more EQ → tap EQ → spin → Stereo shrinks live → Save. Haptic. If EQ leveled, `Lvl 2` on the row.
5. Done. No confirm. They can leave.

Same list on session detail, same cap `D`.

## Data (already on the server)

`session_skill_focuses.assigned_seconds`. PATCH `focus_times`. See [Slice 2](#slice-2--schema--api).

New client: every reflection save with a non-empty list includes `focus_times` summing to `D`. Do not send `area_weights`. Do not send `primary_skill_focus_id` from this card (server derives it).

## Implementation slices

TDD each slice. Backend 1–2 are done.

1. **Allocator** — done.
2. **Schema + API** — done.
3. **List model** — `FocusReflection.assignedSeconds` always a full split of `D` for the tap set (helpers: even split on add/remove, rebalance on set). Payload always sends `focus_times` when the list is non-empty. Parse GET. Tests: two ids → 46/46 of 92; set EQ to 60 → Stereo 32; remove Stereo → EQ 92; empty → omit `focus_times`.
4. **Complete list UI** — replace the tile grid on Session complete with the short list + Add sheet. No wheel yet: minutes are the even split, tappable later. Strip star, full pass, weights, hints, skill-tree link, tile blurbs from this card.
5. **Wheel** — half-screen sheet from the bottom, live rebalance, haptic, autosave on Save. Hide card when `D = 0`. Session detail reuses the list+wheel.
6. **Level pip** — after Save, if that focus’s level rose, show `Lvl n` on the row (data already on skill-progress). No extra copy.

## Do not

- Put eight wheels on screen.
- Explain the rules on the card.
- Keep leftover as a user-facing idea (the engine still allows it; this UI fills `D`).
- Backfill old sessions.
- Gamify with coach lines, XP on this card, or emoji.
- Commit seed-lab scripts.

## Test plan

- 92 min mixing, add Stereo then EQ → list 46 / 46, PATCH times 2760 / 2760, tree +46 each.
- Spin EQ to 60 → Stereo 32 live, Save → tree +60 / +32.
- Remove Stereo → EQ 92.
- Empty list → no skill time.
- Planned EQ at start → complete already shows EQ with 92, no extra tap.
- Production, add Drums + EQ → no `area_weights` in PATCH; areas follow the minutes.
- Short session → card hidden.
- Old session with weights and a star, opened in detail, not edited → same totals as today.
- Reduced motion: wheel usable, no haptic.

## Slice 2 — Schema + API

Shipped. Nullable `assigned_seconds`, PATCH `focus_times`, 422 on overflow / unknown id / running / short+positive. GET lists only non-null rows. Budget area seconds follow assigned minutes. Alembic **0027** (after **0026** on the server).
