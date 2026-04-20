# BeatTrack (Prodify) Monorepo

Mobile App (Expo/React Native) + Backend API (FastAPI) in einem Repository.

## Tech Stack

- Mobile: Expo, React Native, Expo Router, TypeScript
- Backend: FastAPI, SQLAlchemy, Alembic, Pytest
- CI: GitHub Actions (Backend + Mobile Checks)

## Voraussetzungen

- Node.js 20+
- npm 10+
- Python 3.13 (oder kompatibel mit den Dependencies)
- Git
- Optional: Expo Go auf dem Smartphone

## Projektstruktur

- `mobile/` Expo App
- `backend/` FastAPI API + Migrationen + Tests

## Schnellstart (lokal)

### 1) Backend starten

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Healthchecks:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:8000/health/live
Invoke-RestMethod http://127.0.0.1:8000/health/ready
```

### 2) Mobile starten

In einem zweiten Terminal:

```powershell
cd mobile
npm ci
Copy-Item .env.example .env
npm run start
```

Hinweis zu API-URL:

- In Dev kann die App die API-Host-IP automatisch aus Metro ableiten.
- Fuer echte Geraete muss die API auf `0.0.0.0` laufen (siehe Backend-Start oben).
- Fuer Release-Builds muss `EXPO_PUBLIC_API_URL` auf eine HTTPS-URL gesetzt sein.

## Wichtige ENV-Variablen

### Backend (`backend/.env`)

- `SECRET_KEY` (Pflicht)
- `DATABASE_URL` (lokal Standard: `sqlite:///./prodify.db`)
- `CORS_ORIGINS` (JSON-Liste)
- `ENVIRONMENT` (`development` oder `production`)
- Optional: `SENTRY_DSN`, `INTERNAL_JOB_KEY`, Push/FCM Variablen

### Mobile (`mobile/.env`)

- `EXPO_PUBLIC_APP_ENV` (`development`/`production`)
- Optional in Dev: `EXPO_PUBLIC_API_URL`
- Pflicht fuer Release: `EXPO_PUBLIC_API_URL` (HTTPS)
- Optional: `EXPO_PUBLIC_SENTRY_DSN`, RevenueCat Keys

## Datenbank / Migrationen

Migrationen sind Pflicht vor API-Start. Die API validiert das Schema beim Start.

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m alembic upgrade head
```

## Qualitätssicherung

### Backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest -q
```

Optional analytics snapshot endpoint (authenticated):

```powershell
Invoke-RestMethod http://127.0.0.1:8000/stats/kpi/dashboard -Headers @{ Authorization = "Bearer <token>" }
```

Public legal metadata endpoint:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/legal/documents
```

### Mobile

```powershell
cd mobile
npm run lint
npm run format:check
npx tsc --noEmit
npm test -- --ci --coverage=false
```

## Smoke-Test vor Release (manuell)

1. Backend Healthcheck erfolgreich (`/health`)
2. Mobile startet ohne rote Runtime-Fehler
3. Login/Registrierung funktioniert
4. Session-Flow funktioniert (Setup -> Start -> Complete)
5. Dashboard/Stats laden ohne API-Fehler
6. App-Neustart: Session/Auth-Zustand bleibt konsistent

## Release-Hygiene

Nicht committen:

- lokale DB-Dateien (`*.db`, `test_suite.db`)
- Upload-Artefakte (`backend/uploads/`)
- Expo-Cache (`mobile/.expo/`)
- lokale `.env` Dateien

Vor PR:

- `git status` pruefen (nur beabsichtigte Dateien)
- alle lokalen Checks ausfuehren
- CI gruen

## App Store Preparation

- Store metadata source of truth: `mobile/store/STORE_METADATA.en-US.md`
- Screenshot production plan: `mobile/store/SCREENSHOT_PLAN.en-US.md`

## Deployment

- Production deployment runbook: `DEPLOYMENT_CHECKLIST.md`
- Final release gate status: `FINAL_CHECKLIST.md`

## Sentry Setup (Production)

- Backend: `SENTRY_DSN` setzen (Pflicht bei `ENVIRONMENT=production`), optional `SENTRY_TRACES_SAMPLE_RATE` anpassen.
- Mobile: `EXPO_PUBLIC_SENTRY_DSN` in EAS/`.env` setzen (Pflicht fuer Production-Builds).
- Erwartetes Tagging: `environment` aus ENV und `release` aus App-/API-Version.

