from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.models import (
    CompleteSessionRequest,
    RealtimeTokenResponse,
    ReportResponse,
    SessionCreateRequest,
    SessionEvent,
    SessionResponse,
    Visual,
)
from app.services import build_realtime_bootstrap, build_report, create_session_record, make_event
from app.store import session_store

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/sessions", response_model=SessionResponse)
def create_session(payload: SessionCreateRequest) -> SessionResponse:
    session = create_session_record(payload)
    return SessionResponse(
        id=session.id,
        task=session.task,
        locale=session.locale,
        difficulty=session.difficulty,
        persona_name=session.persona_name,
        persona_summary=session.persona_summary,
        opening_line=session.opening_line,
        visual_status=session.visual_status,
    )


@app.post("/sessions/{session_id}/realtime-token", response_model=RealtimeTokenResponse)
def create_realtime_token(session_id: str) -> RealtimeTokenResponse:
    try:
        session_store.get(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc
    return build_realtime_bootstrap(session_id)


@app.get("/sessions/{session_id}/events", response_model=list[SessionEvent])
def list_events(session_id: str) -> list[SessionEvent]:
    try:
        return session_store.get(session_id).events
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc


@app.get("/sessions/{session_id}/visuals", response_model=list[Visual])
def list_visuals(session_id: str) -> list[Visual]:
    try:
        return session_store.get(session_id).visuals
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc


@app.post("/sessions/{session_id}/complete")
def complete_session(session_id: str, payload: CompleteSessionRequest) -> dict[str, str]:
    try:
        session = session_store.get(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc

    session_store.set_transcript(session_id, payload.transcript)
    if session.report is None:
        report = build_report(payload.transcript)
        session_store.set_report(session_id, report)
        session_store.add_event(session_id, make_event("report.ready", "Generated Mom Test report"))
    return {"status": "ok"}


@app.get("/sessions/{session_id}/report", response_model=ReportResponse)
def get_report(session_id: str) -> ReportResponse:
    try:
        session = session_store.get(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc

    if session.report is None:
        raise HTTPException(status_code=409, detail="Report is not ready")
    return session.report
