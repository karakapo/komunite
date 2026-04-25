# Mom Test Wiro Platform

This repository contains:

- `frontend/`: Next.js desktop-first client for onboarding, realtime interview, and reporting
- `backend/`: FastAPI orchestration layer for sessions, visuals, realtime bootstrapping, transcripts, and scoring

## Quick start

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload
```

Set `NEXT_PUBLIC_API_BASE_URL` to the backend origin when running the frontend.

The current implementation ships with a mocked Wiro provider so the product flow is usable before real provider credentials are wired in.
# komunite
