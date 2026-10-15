# Producer messages

What the producer is told, on which channel, and when. Copy follows [studio voice](../GLOSSARY.md). This is the product catalog; the strings live in `backend/app/services/push_templates.py`, `backend/app/services/social_challenge_messages.py`, `backend/app/services/notification_inbox_service.py`, and `mobile/locales/en.json`.

## Channels

| Channel | What it is |
|---------|------------|
| **Push** | Server send to the device (Expo / FCM). Needs a registered token. Honours the server-side notification preferences (see below). |
| **Local** | Scheduled or immediate notification on the device (`expo-notifications`). Needs OS permission. |
| **Inbox** | In-app notification list. Server feed plus local prepends. Filtered by category, frequency, quiet hours, and first-week quiet. |
| **In-app** | Alert or HUD in the running app. Not a notification. |

Jobs that actually fire time-based pushes: `POST /jobs/streak-reminders`, `POST /jobs/session-presence`, `POST /jobs/social-challenges`, and `POST /jobs/engagement` (every 15–30 min; sends only with `FEATURE_FLAG_SMART_NOTIFICATIONS_ENABLED`). If a job is not on a schedule in production, that row does not fire until it is.

Every push that reaches a token is logged in `notification_deliveries` and carries its id as `data.nid`. A tap reports `POST /notifications/{nid}/opened`; a session started within two hours of a non-transactional push credits the most recent one (`POST /jobs/engagement` settles the rest as opened-only or ignored).

## Dual delivery

Some events can hit more than one channel at once. That is current behavior, not a bug to paper over.

- **Streak at risk** — server push in the producer's local evening (local slots only when the device has no push token) *and* inbox while the day is still open.
- **Still there? / 8h stop** — local DATE trigger *and* server job. Foreground also shows an alert.
- **Friend request / session comment** — inbox on the server feed *and* a local notification when the friends screen sees the new row.

---

## Session

| Message | Channel | Trigger | When |
|---------|---------|---------|------|
| **Session saved** · `{type} · {duration}` | Push | Producer stops a session | Immediately after stop |
| **Still there?** · Your session is still running. Open Prodify to continue or end it. | Local + Push | Running session, not paused, elapsed ≥ 3h, not yet nudged | 3h of effective session time (pauses excluded) |
| **Still there?** · Continue, or end it here. | In-app alert | Same, and the app is in the foreground | Same 3h mark |
| **Session ended** · Your session was stopped after 8 hours. | Local + Push | Running session, not paused, elapsed ≥ 8h | 8h of effective session time; server is source of truth for the stop |

Paused sessions are skipped. The 8h local notification can arrive even if the app is closed; the server job must also run for the session to actually stop.

---

## Streak

Streak day = the producer's local calendar day. A streak is at risk when `current_streak > 0`, there is no counted session today, and today is not frozen.

| Message | Channel | Trigger | When |
|---------|---------|---------|------|
| **Streak at risk** · Start a session today to keep your streak. | Inbox | Streak at risk | While the inbox is loaded, until midnight or a session/freeze lands |
| **Streak at risk** · Your {n}-day streak needs a session today — about 2 hours left. | Local | Streak at risk + this device has no registered push token | **22:00 device local**, if that time is still ahead when the app syncs |
| **Streak at risk** · One hour left today to keep your {n}-day streak. | Local | Same | **23:00 device local** |
| **Streak at risk** · About 30 minutes left to keep your {n}-day streak. | Local | Same | **23:30 device local** |
| **Streak at risk** · Your {n}-day streak needs a session — about 2 hours left today. | Push | Streak at risk + active push token | **22:00–22:20 in the producer's timezone** (`/jobs/streak-reminders`, every 15 min) |
| **Streak at risk** · One hour left today to keep your {n}-day streak. | Push | Same | **23:00–23:15 local** |
| **Streak at risk** · About 30 minutes left to keep your {n}-day streak. | Push | Same | **23:25–23:45 local** |
| **{username}'s streak just ended** · {username}'s {n}-day streak just ended 💔 Send support to restart strong. | Push (to friends) | Producer's streak drops from >0 to 0 | On that transition, once per friend per UTC day |
| **Your crew has your back** · {username} sent support after your streak break. Start fresh today. | Push | A friend sends streak encouragement | Immediately |

Local streak slots that are already past today are not scheduled until the next sync. A device gets either the local or the push reminders, never both: once its push token reaches the server, local streak reminders stop. Users without a stored timezone get the push slots in UTC.

With the smart-notifications flag on, the three push slots above stop (`/jobs/streak-reminders` hands over) and the streak reaches the producer as the engine's **Keep the streak alive** candidate instead — at most once per evening, weighed against the other candidates and the daily limits.

---

## Week

| Message | Channel | Trigger | When |
|---------|---------|---------|------|
| **Your week is ready** · Swipe through your studio recap before the new week starts. | Local | Tips category on, frequency not off | Next **Sunday 19:00 device local** |
| **Your streak needs a session today.** | In-app (dashboard spark) | Streak at risk | Whenever Home is shown |
| **Weekly goal done.** / **You're in.** / **{n}-day streak.** | In-app (dashboard spark) | Goal complete / minutes today / streak ≥ 3 | Home |
| **Morning studio. Start a session.** (and afternoon / evening / night variants) | In-app (dashboard spark) | No streak story | Home, by local hour |
| **Do 1 short {minutes} min session today to keep your streak.** | In-app (today's plan) | Streak at risk | Home, when today's plan is shown |

---

## Social

| Message | Channel | Trigger | When |
|---------|---------|---------|------|
| **New friend request** · {username} sent you a friend request. | Inbox + Local | Incoming friend request | Inbox while pending (7 days). Local when the friends screen first sees it (throttled 30s) |
| **Duel invite** · {username} challenged you to a duel. | Push + Inbox | Friend sends a duel invite | Immediately (push). Inbox while the invite is open (48h) |
| **Duel accepted** · {username} accepted your duel. | Push + Inbox | Invitee accepts | Immediately (push). Inbox for 3 days |
| **You won!** · You won “{title}”. Nice work. | Push + Inbox | Challenge completes, recipient is winner | On complete. Inbox for 3 days |
| **It's a tie** · “{title}” ended in a tie. | Push + Inbox | Challenge completes as a tie | Same |
| **Challenge over** · {username} won “{title}”. Time for a rematch? | Push + Inbox | Challenge completes, recipient lost | Same |
| **Duel declined** · {username} declined your duel. | Push + Inbox | Invitee declines | Immediately. Inbox 3 days. Owner only |
| **Invite expired** · {username} didn't answer your duel invite in time. | Push + Inbox | Invite open 48h (`/jobs/social-challenges`) | At expiry. Owner only |
| **Invite withdrawn** · {username} withdrew their duel invite. | Push + Inbox | Owner withdraws | Immediately. Invitee |
| **Challenge ended** · {username} left “{title}”. | Push + Inbox | Member leaves | Immediately. Others |
| **Challenge ended** · {username} ended “{title}”. | Push + Inbox | Owner cancels | Immediately. Others |
| **New comment on your session** · {n} new comment(s) are waiting. | Inbox + Local | Someone comments on the producer's session | Server inbox (5 days, one row per session). Local when friends activity sees it (throttled 60s) |
| **Milestone reached** · {type} unlocked. | Inbox | Achievement unlocks | On unlock. Inbox 30 days. No push |
| **New public commitment** · {username} committed to {n} sessions this week. | Push (to witnesses) | Producer publishes a public promise | Immediately, up to 3 witnesses |

---

## Engagement engine candidates

`engagement/candidates.py` turns each producer's context into at most one candidate per trigger. Copy lives in `push_templates.py`; every candidate also carries its variables and a `path` the app opens on tap.

A push counts as sent, and can be tied to a later session, only when it actually reached a device (`delivered_count > 0`). A failed attempt does not use up the daily limit or the spacing rules. The job reports `sent` as delivered pushes and `failed` separately.

Candidates need 35 points to go out (35–49 low, 50–69 good, 70+ high). Timing weighs the last two weeks fully and older sessions less, and on about 15% of days tries a neighbouring hour inside the production window. An established producer can learn a different hour per weekday.

Each `/jobs/engagement` run (flag on) scores every candidate in `engagement/scoring.py` as a sum of named parts — `timeMatch`, `inactivity`, the trigger's own `streak` / `social` / `challenge` / `rank` urgency, `motivation`, minus `fatigue` and `recentNotificationPenalty`. `engagement/engine.py` then sends **at most one** push per producer and run: the highest-scoring candidate that scores 25 or more (25–44 low, 45–69 good, 70+ high priority), passes the limits and preferences, and is either time-sensitive (streak, social, challenge deadline) or due at the producer's send moment. Its score, reason and variables are stored on the delivery. Only producers with an active push token and smart notifications on are evaluated; in development every decision is logged as `[EngagementEngine]`.

The engine learns from pushes that reached a device, recomputed whenever one converts or settles (`engagement/fatigue.py`, `engagement/motivation.py`):

- **Fatigue** — each ignored push adds to the fatigue score, each converted (or merely opened) one takes some off. Pushes ignored in a row pause smart pushes: 2 for 24h, 3 or more for 48h after the last one, and from 4 on only high-priority candidates (70+) go out.
- **Motivation** — conversion rate per category, smoothed towards a prior so one lucky push does not count as certain. The prior starts at streak 25%, social 30%, challenge 25%, rank 20%, re-engagement 15%, and becomes the install-wide rate once that category has 30 settled pushes. Feeds the `motivation` score part.
- **Send hour** — once an established producer has three or more pushes at a local hour that convert better than the 25% baseline, that hour's first half hour replaces the slot before the production window.

Every run also estimates and stores, per producer (`engagement/return_probability.py`, `engagement/segments.py`):

- **Return probability** — how likely a session starts within 24h, from a hand-weighted logistic function over recency, weekly pace, momentum, usual hour and weekday, streak, challenges, friends' activity, push response and the last session's length. Above 70% a candidate loses up to 15 points (`likelyReturn`): the producer comes anyway. A drop of 30 points or more against the previous local day's value raises a re-engagement candidate ("Keep your rhythm going").
- **Segment** — `dormant` (14+ days away), `new_user` (cold start), `at_risk` (last week under half of the week before, which had 2+ sessions), `power_user` (7+ per week), `active_producer` (3+), otherwise `casual_producer`. Re-engagement weighs ×0.5 for power users, ×1.3 at risk (social ×1.2) and ×1.5 for dormant producers.

`GET /stats/kpi/dashboard` (KPI admins) reports under `engagement` whether the engine helps (`engagement/metrics.py`, 7-day window, smart pushes that reached a device only): **primary** — push → session conversion, sessions per active producer, weekly active producers, D1/D7/D30 retention (producers at least N days old with a session N+ days after signing up); **secondary** — open rate, average session length, streak retention, challenge completion, social conversion; **negative** — smart opt-outs, inactive push tokens, ignored pushes and their rate, and sessions deleted again. Users read in the notification settings and the privacy policy that reminders are personalised from their Prodify activity only.

| Message | Category | Trigger | Opens |
|---------|----------|---------|-------|
| **Keep the streak alive** · Your {streakDays}-day streak needs one session — {time} left today. | Streak | Streak running, no session today, after 18:00 local | Dashboard |
| **Your studio misses you** · It's been {daysInactive} days. Even a short session gets the ideas moving again. | Re-engagement | 3+ days without a session and at most half the usual weekly pace | Dashboard |
| **Keep your rhythm going** · You've been in a good flow. A short session today keeps it that way. | Re-engagement | Return probability fell by 30+ points since the previous day | Dashboard |
| **{rankName} is within reach** · Only {xpRemaining} XP to go — one solid session could get you there. | Rank | A session of the producer's usual length (at least 30 min) would reach the next rank | Dashboard |
| **Challenge ends soon** · “{challengeName}” wraps up soon — {n} sessions still to go. | Challenge | Active challenge ends within 48h, not yet finished | Challenge |
| **Almost there** · {n} more sessions and you finish “{challengeName}”. | Challenge | 1–2 sessions left | Challenge |
| **Back to the challenge?** · “{challengeName}” is waiting on your next session. | Challenge | No progress for 3+ days | Challenge |
| **{friendName} passed you** · They just moved ahead of you this week. One session to win it back. | Social | Lower place on the weekly friend leaderboard than at the last run (`leaderboard_snapshots`) | Friends |
| **{friendName} just finished a session** · {n} minutes in the studio. Your turn? | Social | A friend ended a session of 15+ minutes in the last hour | Friends |

Friends' data is limited to name, session length and time. Blocked users (either direction) and suspended users never appear. Rank names mirror `progression.levelNames` in the app's English locale.

---

## Not wired (templates exist)

These strings exist. Nothing currently sends them on a schedule or from the mobile app.

| Message | Where it lives | Notes |
|---------|----------------|-------|
| **Commitment completed** / **Commitment at risk** / **Commitment progress** | Witness copy in `commitment_witness_service` | Only `started` is sent today |
| **Streak at risk** (generic hours-left body) | `push_templates.streak_reminder` | Used by the profile QA ping (`streak_demo`), not the slot job |
| **Prodify** · Test push from server | Admin / self ping | QA |

---

## Preferences that change delivery

**Server push** reads the producer's preferences (`GET/PUT /users/me/notification-preferences`) before every send, in `engagement/preferences.py`:

- Transactional pushes (session saved, still there?, auto-stopped, moderation, QA pings) always go out.
- Everything else needs the **Smart notifications** master toggle and its category toggle: streak, social, challenge, rank, re-engagement.
- Quiet hours (default 22:30–08:00 in the producer's timezone) hold back every category except streak reminders, whose deadline is midnight.
- A push held back is dropped, not delayed, and leaves no delivery row.

Accounts without saved preferences get these defaults. The first time the app sees such an account, it uploads the settings older versions kept on the device (tips maps to challenge, rank and re-engagement).

In-app **Inbox** and **local social prepends** respect the device settings: category toggles (streak / achievements / social / tips, with streak and social mirrored from the server), frequency `all | important | off`, the server's quiet hours (critical still goes through), and a first-week quiet for social/tips.

**Local streak / presence DATE triggers** do not read those settings. Local weekly recap does check tips + frequency. A notification permission denied on the device is reported once a day as `notifications_disabled`.
