# Prodify — Premium entitlements

Single source of truth for access. The shipped app is **subscription-only**: there is no
free product surface. Paywall copy, mobile `AppAccessGate`, and backend `402` responses
must match this document.

## Access rules

| Check | Meaning |
|-------|---------|
| **Subscriber** | `users.is_premium` or an active RevenueCat `premium` entitlement |
| **Gated API** | Requires a subscriber (`require_subscriber`) |

A signed-in user without an entitlement can authenticate, restore or buy a plan, read
legal documents, and delete their account. Every other authenticated product route returns
`402 Premium entitlement required`.

## Subscriptions (App Store / RevenueCat)

| Product ID | Plan | Notes |
|------------|------|-------|
| `prodify_weekly_access` | Weekly | Target Swiss price: CHF 10.00; no free trial |
| `prodify_6month_access` | 6 months | Target Swiss price: CHF 49.99; primary best-value plan; no intro/trial period in Store |

Disable **Introductory Offers / Free Trial** on both products in App Store Connect. Paywall copy uses live Store prices from RevenueCat.

## Feature matrix

The entire product is behind the subscription. That includes weekly goals, sessions,
streaks, stats, heatmap, records, friends, challenges, commitments, buddy, feed,
leaderboard, progression, notifications, and outcomes (forecast, weekly review, output
metrics).

Service-layer challenge/rescue caps still exist as a second check if a request ever
skipped the router gate. They are not a Free tier.

## API gates (backend)

| Surface | Gate |
|---------|------|
| `/sessions/*`, `/streak/*`, `/goals/*`, `/stats/*`, `/friends/*`, `/social/*`, `/challenges/*`, `/outcomes/*`, `/progression/*`, `/achievements/*`, `/notifications/*`, `/motivational-messages` | `require_subscriber` |
| `PUT /users/me/timezone`, profile picture, public profiles | `require_subscriber` |
| `/auth/*`, `/billing/*`, `/legal/*`, `/feature-flags`, `/jobs/*`, `/health*` | Ungated (auth still required where the route says so) |
| `DELETE /users/me` | Authenticated, no subscription |

Unpaid callers receive `402` with `Premium entitlement required`.

## Mobile UX

- Signed-out users see auth and onboarding.
- Signed-in users without an entitlement are redirected to `/paywall`.
- Subscribers enter the tabs. Gated APIs are fetched only when `hasPremiumAccess()` is true.

## Paywall variants (`en.json`)

| Variant | Promise |
|---------|---------|
| `value` | Early warnings + Sunday review |
| `outcome` | Measurable progress over time |
| `social_proof` | Buddy, challenges, shared accountability |

Do not mention a free weekly-goal tier, or removed features (e.g. AI coach), in paywall or store copy.

## Related docs

- [product-week-model.md](./product-week-model.md) — personal week vs social commitment
