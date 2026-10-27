# App Review notes (App Store Connect)

Paste the block below into **App Store Connect → App Review Information → Notes** when the build
that contains these features is attached to the version. The demo account goes into the
**Sign-In Information** fields as well. Never commit the real passwords.

Before every submission (and again when Apple answers after more than four days), run the
GitHub workflow **Seed Apple review accounts**. It rebuilds both review accounts, undoes what the
last reviewer did (including a sandbox purchase) and checks that the second account meets the
paywall. If the second account is not set up, delete the "SECOND ACCOUNT" paragraph below; the
"create a new account" route still works.

Also make sure both subscriptions (`prodify_weekly_access`, `prodify_6month_access`) are added for
review together with this version (**Add for Review** in their subscription group).

---

```text
Prodify is a subscription-only app that helps music producers track studio sessions, keep a daily streak and stay accountable with friends. An account is required because sessions, streaks and friends sync across devices and are shared with friends.

DEMO ACCOUNT (premium access already active, no purchase needed)
Email: appreview@prodify.app
Password: <see Sign-In Information>
On the first screen, tap "Sign in".

The account contains sample data: a 64-day streak, level 12, sessions over the last two months, 6 friends with activity, a running duel, a duel invite, a buddy and comments from friends. All other profiles are demo accounts.

WHAT TO TRY
1. Dashboard: tap "Start session", let it run for at least 5 minutes, then stop it to see the summary, XP and streak (sessions under 5 minutes do not count toward XP or goals). After the session, a card offers streak reminders; the system permission prompt appears only if you tap "Turn on reminders".
2. Stats and Skill Tree: weekly goal, studio days, trends, personal records and skill progress. The 90-day activity heatmap is on the Profile tab.
3. Friends tab: under "Waiting for you", accept the friend request from kai.loops and accept or decline the duel invite from ines.synth. Switch to the "Challenges" segment to see your buddy mila.waves and the running duel. To send a friend request, tap "Add friend" and enter the exact username noah.strings (without @).
4. User-generated content: on the Dashboard under "Recent sessions", open the session from earlier today that you did not record yourself (if you already recorded one, it is the second entry); mila.waves and juna.mixes commented on it. Press and hold a comment to report it or block its author. Profiles of other users also offer Report and Block, and a friend request can be reported from its Decline menu. Blocked users are listed under Profile > Settings > Blocked users. Everything other producers can read is filtered for objectionable language: usernames, comments, challenge titles and the notes, tags and track titles of sessions shared with friends.
5. Subscription: Profile > Settings > Manage subscription opens the App Store subscription sheet. The demo account's access is granted on our server, so that sheet shows no Prodify subscription for your Apple ID.
6. Account deletion: Profile > Settings > Delete account. It is also available on the paywall, so an account without a subscription can be deleted too.
7. Weekly recap: on Sunday evening a notification opens the weekly recap (requires notification permission).

IN-APP PURCHASE
The demo account already has access, so it never sees the paywall. To test the purchase, sign in with an account without a subscription:
- SECOND ACCOUNT: Email <APPLE_REVIEW_PAYWALL_EMAIL>, Password <APPLE_REVIEW_PAYWALL_PASSWORD>, or
- create a new account (email or Sign in with Apple); the paywall appears right after sign-up.
The paywall shows both auto-renewable subscriptions (weekly and 6 months) with the billed price, plus Restore purchases, Terms and Privacy. To switch accounts on the paywall, tap "Use another account".

Contact: eric.huber.ch@gmail.com
```
