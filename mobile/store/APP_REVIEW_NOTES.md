# App Review notes (App Store Connect)

Paste the block below into **App Store Connect → App Review Information → Notes**. Put the
subscribed account into the **Sign-In Information** fields and replace the two placeholders for
the unsubscribed account. Never commit the real credentials.

Before every submission (and again when Apple answers after more than four days), run the
GitHub workflow **Seed Apple review accounts**. It rebuilds both accounts, undoes what the last
reviewer did (including a sandbox purchase) and checks that the second account meets the paywall.

Also make sure both subscriptions (`prodify_weekly_access`, `prodify_6month_access`) are
"Ready to Submit" and attached to this version under **In-App Purchases and Subscriptions**.

---

```text
Prodify is a subscription-only app for music producers: it tracks studio sessions, streaks,
weekly goals and progress, with friends, 1v1 duels and comments. An account is required because
sessions, streaks and friends sync across devices and are shared with friends.

TWO REVIEW ACCOUNTS
On the first screen, tap "Sign in".

1) Subscribed account (Sign-In Information above)
   Full access with demo data: a 64-day streak, friends, an active buddy, a running duel,
   a duel invite from ines.synth, a friend request from kai.loops and comments on the latest
   session.

2) Unsubscribed account, to review the in-app purchases
   Email: <APPLE_REVIEW_PAYWALL_EMAIL>
   Password: <APPLE_REVIEW_PAYWALL_PASSWORD>
   After signing in, the paywall shows both auto-renewable subscriptions (Weekly and
   6 Months). Purchases use the sandbox and unlock the app right away. "Restore purchases",
   Terms and Privacy are on the paywall.

A subscriber is never shown the plans, so the subscriptions are only visible with account 2.
To move between the accounts on the paywall, tap "Use another account".

ACCOUNT DELETION
Profile → Settings (gear icon) → Delete account. Also available on the paywall, so an account
without a subscription can be deleted too.

USER-GENERATED CONTENT
Everything other producers can read is filtered for objectionable language: usernames,
comments, challenge titles and the notes, tags and track titles of sessions shared with
friends. On a friend's profile, the "…" menu offers
Report and Block. Comments: press and hold a comment on a session for Report, Block or Delete.
Reports reach the moderators immediately; we review every report within 24 hours.
Contact: prodify@gmx.net
```
