# Producer messages

What the producer is told, on which channel, and when. Copy follows [studio voice](../GLOSSARY.md). This is the product catalog; the strings live in `backend/app/services/push_templates.py`, `backend/app/services/social_challenge_messages.py`, `backend/app/services/notification_inbox_service.py`, and `mobile/locales/en.json`.

## Channels

| Channel | What it is |
|---------|------------|
| **Push** | Server send to the device (Expo / FCM). Needs a registered token. Honours the server-side notification preferences (see below). |
| **Local** | Scheduled or immediate notification on the device (`expo-notifications`). Needs OS permission. |
| **Inbox** | In-app notification list. Server feed plus local prepends. Filtered by category, frequency, quiet hours, and first-week quiet. |
| **In-app** | Alert or HUD in the running app. Not a notification. |

Jobs that actually fire time-based pushes: `POST /jobs/streak-reminders`, `POST /jobs/session-presence`, `POST /jobs/social-challenges`. If a job is not on a schedule in production, that row does not fire until it is.

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

## Not wired (templates exist)

These strings exist. Nothing currently sends them on a schedule or from the mobile app.

| Message | Where it lives | Notes |
|---------|----------------|-------|
| **Your studio is waiting** · No session in {n} day(s). Open Prodify and start one. | `POST /notifications/smart-nudge` `kind=inactivity` | Flag `smart_nudges_enabled`. Mobile never calls it. |
| **Your usual studio hour** · You usually start around {HH}:00. Start a session now. | Same, `kind=best_time` | Same |
| **Weekly goal at risk** · {n} session(s) left with {d} day(s) in the week. | Same, `kind=forecast_risk` | Same |
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
