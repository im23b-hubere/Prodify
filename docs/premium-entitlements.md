# Prodify — Premium entitlements

Single source of truth for access. The shipped app is **subscription-only**: there is no
free product surface. Paywall copy, mobile `AppAccessGate`, and backend `402` responses
must match this document.

## Access rules

| Check | Meaning |
|-------|---------|
| **Subscriber** | An unexpired `users.is_premium` grant or an active RevenueCat `app_access` entitlement |
| **Gated API** | Requires a subscriber (`require_subscriber`) |

The entitlement identifier must be identical in RevenueCat, the backend
(`PREMIUM_ENTITLEMENT_NAME`) and the app (`EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`).

## Source of truth

RevenueCat owns purchase state. The backend never interprets webhook event types: every
webhook and every `POST /billing/sync` re-reads the customer via `GET /v1/subscribers/{id}`
and stores the result. A billing grace period counts as active; a cancelled subscription
stays active until its paid period ends.

Access granted outside RevenueCat (manual review accounts, screenshot seeds, legacy
`users.is_premium` flags without a RevenueCat row) is never revoked or replaced by
RevenueCat while it is still valid.

Webhooks authenticate with the `Authorization` header configured in RevenueCat
(`REVENUECAT_WEBHOOK_AUTH`) and/or HMAC signing (`REVENUECAT_WEBHOOK_SIGNING_SECRET`).

A signed-in user without an entitlement can authenticate, restore or buy a plan, read
legal documents, and delete their account. Every other authenticated product route returns
`402 Premium entitlement required`.

`DELETE /users/me` also calls RevenueCat `DELETE /v1/subscribers/{app_user_id}`, where
`app_user_id` is the Prodify user id. That removes the customer record. It does not cancel
the App Store or Play subscription; the paid period stays until the producer cancels it in
the store. A later purchase creates a new RevenueCat customer. When the secret is not
configured, the call is skipped. When RevenueCat or object storage does not respond, the
account stays and the request returns 502 so the producer can retry.

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

Unpaid callers receive `402` with `Premium entitlement required` and error code
`PREMIUM_REQUIRED`. Other `402` responses (challenge, commitment and rescue limits) use
`ERROR_402` and never mean the subscription ended.

## Mobile UX

- Signed-out users see auth and onboarding.
- Signed-in users without an entitlement are redirected to `/paywall`.
- Subscribers enter the tabs. Gated APIs are fetched only when `hasPremiumAccess()` is true.
- A `PREMIUM_REQUIRED` response while the app is open ends local access (memory cache, stored
  entitlement, `is_premium` on the profile) and `AppAccessGate` replaces the screen with
  `/paywall?source=post_auth`. `/billing/*` and `DELETE /users/me` never trigger it. A grant
  cached after the rejected request started (purchase, restore) survives the rejection.
- Leaving the paywall requires the server to agree: when `/billing/sync` answers `inactive`
  after its own RevenueCat check, a stale device grant does not unlock the app. When the
  server cannot be reached, the store's answer is kept.

## Paywall variants (`en.json`)

| Variant | Promise |
|---------|---------|
| `value` | Early warnings + Sunday review |
| `outcome` | Measurable progress over time |
| `social_proof` | Buddy, challenges, shared accountability |

Do not mention a free weekly-goal tier, or removed features (e.g. AI coach), in paywall or store copy.

## Related docs

- [product-week-model.md](./product-week-model.md) — personal week vs social commitment
