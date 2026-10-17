# App Store Privacy Disclosure Audit

Date: 2026-10-17

Scope: Prodify iOS 1.0.1 source and installed native dependencies.
Rechecked after Sign in with Apple / Google and engagement personalisation.

## Tracking

- Select **No, we do not use data for tracking**.
- The source contains no AppTrackingTransparency request, `NSUserTrackingUsageDescription`,
  AdSupport/IDFA access, advertising SDK, or cross-company advertising attribution.
- Do not classify Product Interaction or Crash Data as tracking unless the shipped binary
  or an external service configuration is changed to use it for cross-app tracking.

## Data linked to the user

- Contact Info: email address (account creation, email/password auth, and Sign in with
  Apple / Google when the provider shares an email).
- User Content: username, optional profile picture, session notes, mood/tags, comments,
  goals, and social activity submitted by the user.
- Identifiers: internal account/user identifier, Sign in with Apple / Google subject
  identifiers, and push token.
- Purchases: subscription status and product/entitlement information through Apple and RevenueCat.
- Usage Data / Product Interaction: sessions, streaks, goals, screen-related breadcrumbs,
  feature events, and whether a push was opened or followed by a session, used to provide
  and improve the product and to personalise reminder timing (App Functionality).
- Diagnostics: crash and performance data through Sentry.

Purposes should be limited to App Functionality, Analytics, and Developer Communications
where actually applicable. Do not select Third-Party Advertising or Developer Advertising.

## Data handling evidence

- Sentry scrubs keys containing password, token, secret, authorization, or email before
  sending events and breadcrumbs (`lib/sentry.ts`).
- RevenueCat is configured with the authenticated internal user ID and handles subscription
  offerings, purchases, restore, and entitlement state (`lib/revenuecat.ts`).
- Push tokens are registered only for notifications and can be disabled by the user.
- Smart reminders are personalised server-side from first-party Prodify activity only
  (`backend/app/services/engagement/`); no location, WiFi, contacts, other apps' data, or
  device fingerprinting. Users can switch them off per category in notification settings.
- Permanent in-app account deletion calls `DELETE /users/me`, clears local credentials,
  and the backend removes account-owned and related records.

## Recheck triggers

Repeat this audit before submission if an advertising SDK, attribution SDK, analytics
provider, new sign-in provider, contact import, precise location, or ATT prompt is added.
