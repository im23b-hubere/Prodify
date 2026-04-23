# Security

Date: 2026-04-22

## Secret Scanning

History scan performed with:

`git log --all -G "password|secret|key" -i --pretty=format:"%h %ad %s" --date=short`

Result:

- Matches found in commit messages/diffs referencing secret-related code and docs.
- No production credential values were validated from this command alone.
- Follow-up recommendation: run `gitleaks` or GitHub Advanced Security secret scanning in CI.

## `.env` and Secret Files in Git Ignore

Verified in `.gitignore`:

- `backend/.env`
- `mobile/.env`
- `mobile/.env.*` (except `.env.example`)

Status: PASS

## HTTPS Verification

Repository-wide `http://` references were reviewed.

Findings:

- `http://localhost` usage exists in dev/test/CI contexts (expected).
- Production references in templates/docs use `https://` domains.
- No mandatory production endpoint is configured to plain HTTP.

Action required before release:

- Confirm final `EXPO_PUBLIC_API_URL` is HTTPS in EAS production environment.

## Secret Management Strategy

### Storage Locations

- Mobile secrets: Expo EAS Secrets / EAS Environment Variables.
- Backend secrets: cloud hosting secret manager (Render/Railway/AWS/GCP/etc.).
- Never store production secrets in repository files.

### Rotation Policy

- Rotate critical keys every 90 days or immediately on exposure:
  - `SECRET_KEY`
  - `INTERNAL_JOB_KEY`
  - `WEBHOOK_SECRET`
  - `SENTRY_DSN` tokens (if scoped compromise)
- Rotate DB credentials on staff changes or incident response.

### Access Control

- Principle of least privilege.
- Separate access roles for engineering vs release managers.
- Require MFA on Apple, GitHub, Expo, Sentry, and cloud provider accounts.
- Keep an access inventory with owner + backup owner per system.

## Recommended Additional Hardening

- Add `gitleaks` in CI.
- Add Dependabot/Snyk or equivalent dependency monitoring.
- Define incident runbook and escalation contacts (see `ROLLBACK_PLAN.md`).
