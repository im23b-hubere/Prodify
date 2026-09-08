# Prodify — Week model (personal vs social)

## Rule

| Layer | API | Purpose | UI home |
|-------|-----|---------|---------|
| **Weekly goal** | `POST /goals/set`, `GET /goals/current` | Private session target for the calendar week | **Stats → Your week** |
| **Public promise** | `POST /social/commitment`, `GET /social/commitment` | Optional: share the same target with friends / witnesses | Set from Stats; teaser on **Together** |

## Data flow

1. User sets `target_value` via `/goals/set` (`goal_type: weekly_sessions`).
2. Progress and forecast read from `UserGoal` + completed sessions (`/goals/current`, `/outcomes/goal-forecast/current`).
3. If user opts in to sharing, mobile also calls `/social/commitment` with matching `target_sessions`.
4. **Dashboard** reads `/goals/current` for Today's Plan only — no goal editor on Dashboard.
5. **Together** shows buddy + challenges; public promise is a read-only teaser linking to Stats.

## Day and week boundaries

Personal buckets roll over at the **user's local midnight**, resolved from the IANA timezone the
device reports via `PUT /users/me/timezone` (stored on `users.timezone`, `NULL` means UTC).
This covers the weekly goal, streak days, streak freezes, check-ins, stats and the heatmap.

Cross-user buckets stay on **UTC** on purpose — a shared leaderboard or challenge week cannot
start at a different moment for each participant. That is `social_week_service.current_week_start`,
used by friend insights, buddy weeks, commitments and social challenges.

## Do not

- Set weekly session targets from the Friends tab.
- Mix community weekly challenges (`/challenges/weekly/*`) with social friend challenges (`/social/challenges/*`).

## Premium

The whole week model is subscription-only, including weekly goal setup. See [premium-entitlements.md](./premium-entitlements.md).
