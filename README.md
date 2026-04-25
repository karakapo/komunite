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

Notes:

- If `3000` is busy, Next.js will automatically move to the next open port, usually `3001`.
- If the UI loads without styles, or you see missing chunk errors such as `Cannot find module './825.js'`, clear the Next build cache and restart:

```bash
cd frontend
rm -rf .next
npm run dev
```

- If the problem still continues after a cache clear, reinstall frontend dependencies and start fresh:

```bash
cd frontend
rm -rf .next node_modules package-lock.json
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

Configure Wiro before starting the backend:

```bash
export WIRO_AUTH_MODE="none"  # default
# İstersen sonra auth açabilirsin:
# export WIRO_API_KEY="your-project-api-key"
# export WIRO_AUTH_MODE="api-key"  # or "signature"
# export WIRO_API_SECRET="your-project-api-secret"  # required only for signature mode
export WIRO_REALTIME_OWNER_SLUG="openai"
export WIRO_REALTIME_MODEL_SLUG="gpt-realtime"
export WIRO_REPORT_OWNER_SLUG="Qwen"
export WIRO_REPORT_MODEL_SLUG="Qwen3.6-27B"
# Optional: if the selected realtime model needs exact schema fields, override the
# POST /Run payload completely with a JSON object string:
# export WIRO_REALTIME_PAYLOAD_JSON='{"agent_id":"your-elevenlabs-agent-id"}'
```

The backend now creates a real Wiro session by calling `POST https://api.wiro.ai/v1/Run/openai/gpt-realtime`
and returns the `socketaccesstoken` plus `wss://socket.wiro.ai/v1` to the frontend.
When a session completes, the backend also sends the transcript to `POST https://api.wiro.ai/v1/Run/Qwen/Qwen3.6-27B`
to generate the Mom Test report, with a local fallback if the model response is unavailable or malformed.
# komunite
