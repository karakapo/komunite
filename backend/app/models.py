from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Literal

from pydantic import BaseModel, Field


Difficulty = Literal["easy", "medium", "hard"]
TranscriptSpeaker = Literal["user", "simulated_persona"]
VisualStatus = Literal["pending", "ready"]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SessionCreateRequest(BaseModel):
    difficulty: Difficulty
    task: str
    locale: str = "en-US"


class SessionResponse(BaseModel):
    id: str
    task: str
    locale: str
    difficulty: Difficulty
    persona_name: str
    persona_summary: str
    opening_line: str
    visual_status: VisualStatus


class RealtimeTokenResponse(BaseModel):
    session_id: str
    provider: str
    websocket_url: str
    ephemeral_token: str
    voice_profile: str


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


class SessionRecord(BaseModel):
    id: str
    task: str
    locale: str
    difficulty: Difficulty
    persona_name: str
    persona_summary: str
    opening_line: str
    visual_status: VisualStatus = "pending"
    visuals: List[Visual]
    events: List[SessionEvent]
    transcript: List[TranscriptTurn] = Field(default_factory=list)
    report: ReportResponse | None = None
    created_at: datetime = Field(default_factory=utcnow)
