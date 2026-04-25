from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Literal

from pydantic import BaseModel, Field


Scenario = Literal["motivasyon", "fake_interest", "hard_mode"]
TranscriptSpeaker = Literal["user", "simulated_persona"]
VisualStatus = Literal["pending", "ready"]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SessionCreateRequest(BaseModel):
    task: str
    scenario: Scenario = "motivasyon"
    locale: str = "en-US"


class SessionResponse(BaseModel):
    id: str
    task: str
    scenario: Scenario
    locale: str
    persona_name: str
    persona_summary: str
    opening_line: str
    visual_status: VisualStatus


class RealtimeTokenResponse(BaseModel):
    session_id: str
    provider: str
    task_id: str
    websocket_url: str
    ephemeral_token: str
    voice_profile: str
    persona_name: str
    opening_line: str


class SessionEvent(BaseModel):
    id: str
    kind: str
    message: str
    created_at: datetime = Field(default_factory=utcnow)


class Visual(BaseModel):
    pose_index: int
    status: VisualStatus = "pending"
    image_url: str | None = None


class TranscriptTurn(BaseModel):
    speaker: TranscriptSpeaker
    text: str
    started_at: datetime
    ended_at: datetime


class CompleteSessionRequest(BaseModel):
    transcript: List[TranscriptTurn]


class ReportEvidence(BaseModel):
    quote: str
    insight: str
    speaker: TranscriptSpeaker


class ReportResponse(BaseModel):
    overall_score: int
    category_scores: Dict[str, int]
    strengths: List[str]
    mistakes: List[str]
    evidence: List[ReportEvidence]
    next_steps: List[str]


class RealtimeTaskDebugResponse(BaseModel):
    task_id: str
    status: str | None = None
    pexit: str | None = None
    debugoutput: str | None = None
    errors: List[str] = Field(default_factory=list)


class SessionRecord(BaseModel):
    id: str
    task: str
    scenario: Scenario
    locale: str
    persona_name: str
    persona_summary: str
    opening_line: str
    visual_status: VisualStatus = "pending"
    visuals: List[Visual]
    events: List[SessionEvent]
    realtime_task_id: str | None = None
    transcript: List[TranscriptTurn] = Field(default_factory=list)
    report: ReportResponse | None = None
    created_at: datetime = Field(default_factory=utcnow)
