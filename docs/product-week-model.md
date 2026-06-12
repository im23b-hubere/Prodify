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

## Do not

- Set weekly session targets from the Friends tab.
- Mix community weekly challenges (`/challenges/weekly/*`) with social friend challenges (`/social/challenges/*`).

## Premium

Goal forecast and weekly review are premium-gated. Weekly goal setup remains free. See [premium-entitlements.md](./premium-entitlements.md).
