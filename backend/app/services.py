from __future__ import annotations

import base64
import uuid
from datetime import timedelta
from threading import Thread
from time import sleep

from app.config import settings
from app.models import (
    ReportEvidence,
    ReportResponse,
    RealtimeTokenResponse,
    SessionCreateRequest,
    SessionEvent,
    SessionRecord,
    TranscriptTurn,
    Visual,
    utcnow,
)
from app.store import session_store


def build_persona_summary(difficulty: str) -> tuple[str, str]:
    if difficulty == "easy":
        return (
            "Mina Patel",
            "A collaborative product manager who answers directly and offers concrete workflow stories.",
        )
    if difficulty == "hard":
        return (
            "Mina Patel",
            "A busy product manager who gives partial answers, jumps across tools, and needs strong follow-up questions.",
        )
    return (
        "Mina Patel",
        "A realistic product manager balancing call notes, summaries, and stakeholder updates across several tools.",
    )


def build_opening_line(difficulty: str) -> str:
    if difficulty == "easy":
        return "Happy to help. I can walk you through the last few times this workflow got messy."
    if difficulty == "hard":
        return "Sure, but I am between meetings, so you may need to be specific."
    return "Happy to chat. This workflow comes up a few times each week and it is not exactly clean."


def make_event(kind: str, message: str) -> SessionEvent:
    return SessionEvent(id=str(uuid.uuid4()), kind=kind, message=message)


def make_svg_data_uri(label: str, accent: str, pose_text: str) -> str:
    svg = f"""
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#10192d" />
          <stop offset="100%" stop-color="{accent}" />
        </linearGradient>
      </defs>
      <rect width="1200" height="1200" fill="url(#bg)" />
      <circle cx="620" cy="350" r="170" fill="#f2c8b3" />
      <rect x="410" y="520" rx="80" ry="80" width="420" height="420" fill="#071422" />
      <rect x="370" y="520" rx="120" ry="120" width="500" height="500" fill="rgba(255,255,255,0.06)" />
      <text x="90" y="120" fill="#9fe9ff" font-size="42" font-family="Arial">WIRO LIVE AVATAR</text>
      <text x="90" y="1010" fill="#ffffff" font-size="66" font-family="Arial">{label}</text>
      <text x="90" y="1084" fill="#dfe9ff" font-size="40" font-family="Arial">{pose_text}</text>
    </svg>
    """.strip()
    encoded = base64.b64encode(svg.encode("utf-8")).decode("ascii")
    return f"data:image/svg+xml;base64,{encoded}"


def generate_visuals(session_id: str, persona_name: str) -> None:
    sleep(2)
    accents = ["#1943d4", "#0b9f89", "#9a4dff"]
    poses = ["Pose 01 / listening", "Pose 02 / speaking", "Pose 03 / emphasis"]
    visuals = [
        Visual(
            pose_index=index,
            status="ready",
            image_url=make_svg_data_uri(persona_name, accents[index], poses[index]),
        )
        for index in range(3)
    ]
    session_store.set_visuals(session_id, visuals)
    session_store.add_event(session_id, make_event("visuals.ready", "Avatar poses are ready"))


def schedule_visual_generation(session_id: str, persona_name: str) -> None:
    worker = Thread(target=generate_visuals, args=(session_id, persona_name), daemon=True)
    worker.start()


def create_session_record(payload: SessionCreateRequest) -> SessionRecord:
    session_id = str(uuid.uuid4())
    persona_name, persona_summary = build_persona_summary(payload.difficulty)
    opening_line = build_opening_line(payload.difficulty)
    visuals = [Visual(pose_index=index, status="pending", image_url=None) for index in range(3)]

    session = SessionRecord(
        id=session_id,
        task=payload.task,
        locale=payload.locale,
        difficulty=payload.difficulty,
        persona_name=persona_name,
        persona_summary=persona_summary,
        opening_line=opening_line,
        visuals=visuals,
        events=[
            make_event("session.created", "Session created"),
            make_event("visuals.pending", "Avatar poses are generating"),
        ],
    )
    session_store.create(session)
    schedule_visual_generation(session_id, persona_name)
    return session


def build_realtime_bootstrap(session_id: str) -> RealtimeTokenResponse:
    now = utcnow()
    token = f"{session_id}.{int((now + timedelta(minutes=20)).timestamp())}"
    session_store.add_event(
        session_id,
        make_event("realtime.bootstrap", "Issued ephemeral realtime bootstrap token"),
    )
    return RealtimeTokenResponse(
        session_id=session_id,
        provider=settings.wiro_provider_name,
        websocket_url=settings.realtime_websocket_url,
        ephemeral_token=token,
        voice_profile=settings.voice_profile,
    )


def summarize_user_strengths(user_turns: list[TranscriptTurn]) -> list[str]:
    if not user_turns:
        return ["You completed the session, but no user transcript turns were captured."]
    return [
        "You asked at least one concrete follow-up about a recent workflow.",
        "You kept the conversation focused on behavior instead of pure opinions.",
        "You gave the simulated user room to describe operational friction in detail.",
    ]


def summarize_user_mistakes(user_turns: list[TranscriptTurn]) -> list[str]:
    joined = " ".join(turn.text.lower() for turn in user_turns)
    mistakes: list[str] = []
    if "would" in joined or "will" in joined:
        mistakes.append("Some questions drifted toward hypothetical future behavior.")
    if not any("last" in turn.text.lower() or "recent" in turn.text.lower() for turn in user_turns):
        mistakes.append("You did not anchor enough questions in a specific past event.")
    if not any("why" in turn.text.lower() or "what happened" in turn.text.lower() for turn in user_turns):
        mistakes.append("Your follow-ups could go deeper on causes and decision points.")
    if not mistakes:
        mistakes.append(
            "The session was strong overall; next gains will come from sharper evidence-seeking probes."
        )
    return mistakes


def build_report(transcript: list[TranscriptTurn]) -> ReportResponse:
    user_turns = [turn for turn in transcript if turn.speaker == "user"]
    persona_turns = [turn for turn in transcript if turn.speaker == "simulated_persona"]
    evidence: list[ReportEvidence] = []

    if user_turns:
        evidence.append(
            ReportEvidence(
                quote=user_turns[0].text,
                insight="This question shows your opening angle and whether you anchored on behavior.",
                speaker="user",
            )
        )
    if persona_turns:
        evidence.append(
            ReportEvidence(
                quote=persona_turns[0].text,
                insight="This answer provides the main workflow context the interviewer should probe deeper.",
                speaker="simulated_persona",
            )
        )
    if len(user_turns) > 1:
        evidence.append(
            ReportEvidence(
                quote=user_turns[-1].text,
                insight="Your later turns reveal whether you moved from surface pain into concrete evidence.",
                speaker="user",
            )
        )

    category_scores = {
        "question_quality": 82 if user_turns else 30,
        "bias_leading_risk": 73 if len(user_turns) > 1 else 52,
        "hypothetical_vs_real_behavior_ratio": 79,
        "depth_of_follow_up": 76 if len(user_turns) > 2 else 64,
        "evidence_seeking_quality": 80 if persona_turns else 58,
        "learning_extraction_quality": 77 if len(transcript) >= 3 else 60,
    }
    overall_score = round(sum(category_scores.values()) / len(category_scores))

    return ReportResponse(
        overall_score=overall_score,
        category_scores=category_scores,
        strengths=summarize_user_strengths(user_turns),
        mistakes=summarize_user_mistakes(user_turns),
        evidence=evidence,
        next_steps=[
            "Ask for the most recent concrete example before exploring opinions.",
            "Pressure-test pain intensity by asking what broke, slowed down, or got manually stitched together.",
            "End with switching behavior or existing workaround questions instead of feature validation.",
        ],
    )
