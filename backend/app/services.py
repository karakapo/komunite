from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import uuid
from threading import Thread
from time import sleep

import httpx
from fastapi import HTTPException

from app.config import settings
from app.models import (
    ReportEvidence,
    ReportResponse,
    RealtimeTokenResponse,
    Scenario,
    SessionCreateRequest,
    SessionEvent,
    SessionRecord,
    TranscriptTurn,
    Visual,
)
from app.store import session_store


def build_realtime_system_instructions(session: SessionRecord) -> str:
    scenario_block = build_scenario_prompt(session.scenario)
    return (
        "You are roleplaying as the interview persona for a Mom Test style customer discovery call. "
        "The player is trying to understand whether an AI study planning app solves a real user problem. "
        f"Your name is {session.persona_name}. "
        f"Opening tone: {session.opening_line} "
        f"Task context: {session.task}. "
        f"Locale: {session.locale}. "
        "Stay fully in character, answer naturally, keep replies concise and conversational, "
        "and do not reveal the hidden problem too early.\n\n"
        f"{scenario_block}"
    )


def build_wiro_headers() -> dict[str, str]:
    auth_mode = settings.auth_mode.lower()
    if auth_mode == "none":
        return {}

    if not settings.api_key:
        raise HTTPException(
            status_code=503,
            detail="WIRO_API_KEY is not configured",
        )

    headers = {"x-api-key": settings.api_key}
    if auth_mode == "signature":
        if not settings.api_secret:
            raise HTTPException(
                status_code=503,
                detail="WIRO_API_SECRET is required when WIRO_AUTH_MODE=signature",
            )
        nonce = secrets.token_hex(16)
        digest = hmac.new(
            settings.api_key.encode("utf-8"),
            f"{settings.api_secret}{nonce}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        headers["x-signature"] = digest
        headers["x-nonce"] = nonce
    return headers


def create_wiro_realtime_session(session: SessionRecord) -> tuple[str, str]:
    payload = {
        "voice": settings.voice_profile,
        "system_instructions": build_realtime_system_instructions(session),
        "input_audio_format": settings.input_audio_format,
        "output_audio_format": settings.output_audio_format,
        "input_audio_rate": settings.input_audio_rate,
        "output_audio_rate": settings.output_audio_rate,
    }
    url = (
        f"{settings.api_base_url}/Run/"
        f"{settings.realtime_owner_slug}/{settings.realtime_model_slug}"
    )

    try:
        response = httpx.post(
            url,
            json=payload,
            headers=build_wiro_headers(),
            timeout=30.0,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text or "Wiro API request failed"
        raise HTTPException(status_code=502, detail=f"Wiro API error: {detail}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Unable to reach Wiro API") from exc

    body = response.json()
    if not body.get("result"):
        errors = body.get("errors") or ["Unknown Wiro API error"]
        raise HTTPException(status_code=502, detail=f"Wiro API error: {', '.join(errors)}")

    task_id = body.get("taskid")
    token = body.get("socketaccesstoken")
    if not task_id or not token:
        raise HTTPException(status_code=502, detail="Wiro API response missing taskid or socketaccesstoken")

    return str(task_id), str(token)


def build_persona_summary(scenario: Scenario) -> tuple[str, str]:
    if scenario == "motivasyon":
        return (
            "Ece",
            "Universite 2. sinif ogrencisi; study app fikrine sicak bakiyor ama asil sorunu disiplin ve aliskanlik surdurmek.",
        )
    if scenario == "fake_interest":
        return (
            "Zeynep",
            "Tip ogrencisi; AI destekli planlama fikrine mantikli yaklasiyor ama mevcut sistemini birakmanin maliyeti yuksek geliyor.",
        )
    return (
        "Mert",
        "Final senesi ogrenci; daginik anlatir, verimlilik kaygisini tekrarlar ve gercek problemi acmak icin iyi follow-up gerekir.",
    )


def build_opening_line(scenario: Scenario) -> str:
    if scenario == "motivasyon":
        return "Ya aslinda boyle AI bir sey olsa baya iyi olur gibi geliyor."
    if scenario == "fake_interest":
        return "Evet, AI destekli planlama mantikli olabilir aslinda."
    return "Daha verimli olmam lazim ama nereden toparlayacagimi ben de tam bilmiyorum."


def build_scenario_prompt(scenario: Scenario) -> str:
    common_rules = (
        "General behavior rules:\n"
        "- Speak in Turkish.\n"
        "- Sound like a real student, not an evaluator.\n"
        "- Do not dump your full backstory in one answer.\n"
        "- At first, stay somewhat surface level and show mild interest in the product idea.\n"
        "- Reveal the deeper problem only if the interviewer asks strong behavioral follow-up questions.\n"
        "- Never explicitly say 'my real problem is ...'.\n"
        "- The hidden goal is to test whether the interviewer can distinguish a tool request from the real underlying problem.\n\n"
    )

    if scenario == "motivasyon":
        return (
            common_rules
            + "ACTIVE_SCENARIO: motivasyon\n"
            "Identity:\n"
            "- You are a 2nd year university student.\n"
            "Background:\n"
            "- You usually study for exams at the last minute.\n"
            "- You spend a lot of time on YouTube and social media.\n"
            "- You have tried two study apps before.\n"
            "Behavior:\n"
            "- You are positive and easygoing.\n"
            "- You can quickly say a product sounds useful.\n"
            "- You may say things like 'boyle AI bir sey olsa iyi olur'.\n"
            "Hidden truth:\n"
            "- The real problem is not missing tools.\n"
            "- The real problem is discipline and inability to sustain habits.\n"
            "If the interviewer probes well, gradually reveal:\n"
            "- You make plans but stop following them.\n"
            "- You fall back into distraction and inconsistency.\n"
            "- Your current issue is execution, not planning quality.\n"
        )
    if scenario == "fake_interest":
        return (
            common_rules
            + "ACTIVE_SCENARIO: fake_interest\n"
            "Identity:\n"
            "- You are a medical student.\n"
            "Background:\n"
            "- Your schedule is already intense.\n"
            "- You already keep notes with your own system.\n"
            "- You use ChatGPT in a light, surface-level way.\n"
            "Behavior:\n"
            "- You sound logical and organized.\n"
            "- You can make the interviewer feel they are on the right track.\n"
            "- You may say AI planning sounds good in principle.\n"
            "Hidden truth:\n"
            "- The real problem is not planning quality.\n"
            "- The real problem is overload, lack of time, and switching cost.\n"
            "- You do not want to learn a brand new tool unless the value is extremely obvious.\n"
            "If the interviewer probes well, gradually reveal:\n"
            "- Your current system already works well enough.\n"
            "- Changing systems feels expensive mentally and practically.\n"
            "- Even a good tool may fail because onboarding friction is too high.\n"
        )
    return (
        common_rules
        + "ACTIVE_SCENARIO: hard_mode\n"
        "Identity:\n"
        "- You are a final year student and also job hunting.\n"
        "Background:\n"
        "- You feel strong career anxiety.\n"
        "- You often feel like you should always be productive.\n"
        "- You consume a lot of productivity content.\n"
        "Behavior:\n"
        "- You describe problems, but the solution is unclear even to you.\n"
        "- You can sound self-aware but also scattered.\n"
        "- You may say things like 'daha verimli olmam lazim'.\n"
        "Hidden truth:\n"
        "- The real problem is not a missing study tool.\n"
        "- The real problem is mental load, decision fatigue, and overthinking.\n"
        "- You often know what to do but cannot start consistently.\n"
        "If the interviewer probes well, gradually reveal:\n"
        "- Your days feel fragmented and mentally heavy.\n"
        "- You are stuck between many priorities.\n"
        "- The block is execution paralysis more than planning.\n"
    )


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
    persona_name, persona_summary = build_persona_summary(payload.scenario)
    opening_line = build_opening_line(payload.scenario)
    visuals = [Visual(pose_index=index, status="pending", image_url=None) for index in range(3)]

    session = SessionRecord(
        id=session_id,
        task=payload.task,
        scenario=payload.scenario,
        locale=payload.locale,
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
    session = session_store.get(session_id)
    task_id, token = create_wiro_realtime_session(session)
    session_store.add_event(
        session_id,
        make_event("realtime.bootstrap", f"Issued Wiro realtime bootstrap token for task {task_id}"),
    )
    return RealtimeTokenResponse(
        session_id=session_id,
        provider=settings.wiro_provider_name,
        task_id=task_id,
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


def build_fallback_report(transcript: list[TranscriptTurn]) -> ReportResponse:
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


def format_transcript_for_prompt(transcript: list[TranscriptTurn]) -> str:
    if not transcript:
        return "No transcript was captured."

    return "\n".join(
        f"{index + 1}. {turn.speaker}: {turn.text}"
        for index, turn in enumerate(transcript)
    )


def extract_report_payload(body: object) -> dict[str, object] | None:
    if isinstance(body, dict):
        for key in ("output", "response", "text", "content", "result", "data"):
            value = body.get(key)
            extracted = extract_report_payload(value)
            if extracted is not None:
                return extracted
        return None

    if isinstance(body, list):
        for item in body:
            extracted = extract_report_payload(item)
            if extracted is not None:
                return extracted
        return None

    if isinstance(body, str):
        candidate = body.strip()
        if candidate.startswith("```"):
            lines = candidate.splitlines()
            if len(lines) >= 3:
                candidate = "\n".join(lines[1:-1]).strip()
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) else None

    return None


def build_report_with_llm(transcript: list[TranscriptTurn]) -> ReportResponse:
    fallback_report = build_fallback_report(transcript)
    prompt = (
        "Analyze this Mom Test style interview transcript and return only valid JSON with these keys: "
        "overall_score, category_scores, strengths, mistakes, evidence, next_steps. "
        "category_scores must include question_quality, bias_leading_risk, "
        "hypothetical_vs_real_behavior_ratio, depth_of_follow_up, evidence_seeking_quality, "
        "learning_extraction_quality. evidence must be an array of objects with quote, insight, speaker. "
        "overall_score and every category score must be integers between 0 and 100. "
        "strengths, mistakes, and next_steps must each contain exactly 3 concise strings. "
        "Use only speakers 'user' and 'simulated_persona'.\n\n"
        "Transcript:\n"
        f"{format_transcript_for_prompt(transcript)}"
    )
    payload = {"input": prompt}
    url = (
        f"{settings.api_base_url}/Run/"
        f"{settings.report_owner_slug}/{settings.report_model_slug}"
    )

    try:
        response = httpx.post(
            url,
            json=payload,
            headers=build_wiro_headers(),
            timeout=45.0,
        )
        response.raise_for_status()
        raw_body = response.json()
        parsed = extract_report_payload(raw_body)
        if parsed is None:
            return fallback_report
        return ReportResponse.model_validate(parsed)
    except (httpx.HTTPError, ValueError):
        return fallback_report


def build_report(transcript: list[TranscriptTurn]) -> ReportResponse:
    return build_report_with_llm(transcript)
