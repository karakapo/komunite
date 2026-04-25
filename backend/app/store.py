from __future__ import annotations

from threading import Lock

from app.models import ReportResponse, SessionEvent, SessionRecord, TranscriptTurn, Visual


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, SessionRecord] = {}
        self._lock = Lock()

    def create(self, session: SessionRecord) -> SessionRecord:
        with self._lock:
            self._sessions[session.id] = session
            return session

    def get(self, session_id: str) -> SessionRecord:
        with self._lock:
            return self._sessions[session_id]

    def add_event(self, session_id: str, event: SessionEvent) -> None:
        with self._lock:
            self._sessions[session_id].events.append(event)

    def set_visuals(self, session_id: str, visuals: list[Visual]) -> None:
        with self._lock:
            session = self._sessions[session_id]
            session.visuals = visuals
            session.visual_status = "ready"

    def set_transcript(self, session_id: str, transcript: list[TranscriptTurn]) -> None:
        with self._lock:
            self._sessions[session_id].transcript = transcript

    def set_realtime_task_id(self, session_id: str, task_id: str) -> None:
        with self._lock:
            self._sessions[session_id].realtime_task_id = task_id

    def set_report(self, session_id: str, report: ReportResponse) -> None:
        with self._lock:
            self._sessions[session_id].report = report


session_store = SessionStore()
