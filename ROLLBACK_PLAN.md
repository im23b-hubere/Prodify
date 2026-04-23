# Rollback Plan

Date: 2026-04-22

## Last Stable Version

- Mobile app version: `1.0.0` (update per release)
- Backend release tag/commit: `<set-at-release-time>`
- Database revision: `alembic current` output captured at deploy time

## Backend Rollback Commands

Application rollback:

- Re-deploy previous stable image/commit from CI artifacts.

Database rollback:

- Single migration rollback:
  - `python -m alembic downgrade -1`
- Rollback to explicit revision:
  - `python -m alembic downgrade <revision>`
- Scripted helper:
  - `.\scripts\db-rollback.ps1 -1` (Windows)
  - `./scripts/db-rollback.sh -1` (Linux/macOS)

## Mobile Rollback Strategy

- Keep previous TestFlight/App Store build available.
- If release issue is critical:
  - Pause phased release / remove release from sale.
  - Submit previous stable binary as expedited fix if needed.
- Maintain rollback release notes template for fast submission.

## Incident Response Plan

### Roles (Fill In)

- Incident commander: `<name + contact>`
- Backend owner: `<name + contact>`
- Mobile owner: `<name + contact>`
- Communications owner: `<name + contact>`

### Escalation Process

1. Detect incident (alerts, support, crash spike).
2. Classify severity (SEV-1/SEV-2/SEV-3).
3. Open incident channel and assign commander.
4. Decide rollback vs hotfix within 15 minutes for SEV-1.
5. Execute rollback checklist.
6. Publish user/internal status updates.
7. Postmortem within 48 hours.

### Communication Channels

- Primary chat channel: `<Slack/Teams channel>`
- On-call phone bridge: `<bridge number/link>`
- Status page: `<status-page-url>`
- Customer support mailbox: `support@prodify.app`
