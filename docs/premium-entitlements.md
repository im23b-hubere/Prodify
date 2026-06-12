# Prodify — Premium entitlements

Single source of truth for what Free vs Premium includes. Paywall copy, mobile UI gates, and backend `402` responses must match this matrix.

## Access rules

| Check | Meaning |
|-------|---------|
| **Premium** | `users.is_premium` or active RevenueCat subscription |
| **Trial** | `trial_active` from billing sync **or** server onboarding trial (`onboarding_trial_days`) |
| **Gated API** | Requires premium **or** trial (`require_premium_or_trial`) |

Weekly goal setup (`/goals/*`) is always free.

## Feature matrix

| Feature | Free | Premium / trial | Product pillar |
|---------|------|-----------------|----------------|
| Weekly session goal (`/goals/set`, `/goals/current`) | Yes | Yes | Rhythm |
| Week progress, studio-day strip (Stats) | Yes | Yes | Rhythm |
| Goal forecast (`/outcomes/goal-forecast/current`) | No | Yes | Rhythm |
| Weekly review (`/outcomes/weekly-review/*`) | No | Yes | Rhythm |
| Today's Plan, streak, session tracking | Yes | Yes | Rhythm |
| Basic stats, heatmap, personal records | Yes | Yes | Proof |
| 1 active friend challenge | Yes | Yes | Accountability |
| 3+ challenges, duration > 7 days | No | Yes | Accountability |
| Commitment period > 7 days, multiple commitment types | No | Yes | Accountability |
| Buddy, feed, leaderboard (core) | Yes | Yes | Accountability |

## API gates (backend)

| Endpoint | Gate |
|----------|------|
| `GET /outcomes/goal-forecast/current` | `require_premium_or_trial` |
| `GET /outcomes/weekly-review/current` | `require_premium_or_trial` |
| `POST /outcomes/weekly-review/generate` | `require_premium_or_trial` |
| `GET /outcomes/output-metrics/current` | Free |
| `POST /goals/set`, `GET /goals/current` | Free |

Free users receive `402` with `Premium entitlement required` on gated outcomes routes.

## Mobile UX

- **Free:** Your Week shows progress + studio days; forecast area shows Premium teaser (no silent empty state).
- **Free:** Weekly Recap loads week stats only; review generate + insights show Premium teaser → paywall.
- **Premium / trial:** Full forecast + weekly review; gated APIs fetched only when `hasPremiumAccess()` is true.

## Paywall variants (`en.json`)

| Variant | Promise |
|---------|---------|
| `value` | Early warnings + Sunday review (weekly goal is free) |
| `outcome` | Measurable progress over time |
| `social_proof` | Buddy, challenges, shared accountability |

Do not mention removed features (e.g. AI coach) in paywall or store copy.

## Related docs

- [product-week-model.md](./product-week-model.md) — personal week vs social commitment
