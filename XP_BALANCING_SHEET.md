# XP Balancing Sheet

This sheet captures the current backend XP curve for completed sessions.

## Current Formula

- XP floor: sessions under `5` minutes grant `0` XP
- Base XP at `5` minutes: `5`
- Linear gain after floor: `+0.5 XP` per extra minute (rounded down via integer conversion)
- Milestone bonuses:
  - `+3` at `25+` minutes
  - `+5` at `45+` minutes
  - `+7` at `75+` minutes
- Hard cap per completed session: `85` XP

## Reference Points

- `5 min` -> `5 XP`
- `10 min` -> `7 XP`
- `15 min` -> `10 XP`
- `20 min` -> `12 XP`
- `25 min` -> `18 XP`
- `30 min` -> `20 XP`
- `45 min` -> `33 XP`
- `60 min` -> `40 XP`
- `75 min` -> `55 XP`
- `90 min` -> `62 XP`
- `120 min` -> `77 XP`

## Product Intent

- Short sessions still feel rewarding, but cannot be exploited.
- Medium sessions progress steadily without causing fast early-level inflation.
- Deep-work sessions get clear step-up rewards.

## Quick Tuning Knobs

- `BASE_SESSION_XP`: controls first-session feel.
- `SESSION_XP_PER_MINUTE_AFTER_FLOOR`: controls slope for 5-45 minute range.
- Milestone thresholds/bonuses (`25`, `45`, `75`): controls deep-work emphasis.
- `SESSION_XP_MAX`: controls anti-abuse ceiling.
