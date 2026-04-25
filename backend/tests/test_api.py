from fastapi.testclient import TestClient

from app import services
from app.main import app
from app.models import ReportEvidence, ReportResponse


client = TestClient(app)


def test_create_session_and_generate_visuals() -> None:
    response = client.post(
        "/sessions",
        json={
            "task": "ai-study-planner-validation",
            "scenario": "motivasyon",
            "locale": "en-US",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["persona_name"] == "Ece"
    assert payload["scenario"] == "motivasyon"
    assert payload["visual_status"] in {"pending", "ready"}

    visuals = client.get(f"/sessions/{payload['id']}/visuals")
    assert visuals.status_code == 200
    assert len(visuals.json()) == 3


def test_complete_session_creates_report(monkeypatch) -> None:
    services.session_store._sessions.clear()
    session_response = client.post(
        "/sessions",
        json={
            "task": "ai-study-planner-validation",
            "scenario": "hard_mode",
            "locale": "en-US",
        },
    )
    session_id = session_response.json()["id"]

    monkeypatch.setattr(
        services,
        "build_report_with_llm",
        lambda transcript: ReportResponse(
            overall_score=88,
            category_scores={
                "question_quality": 90,
                "bias_leading_risk": 82,
                "hypothetical_vs_real_behavior_ratio": 87,
                "depth_of_follow_up": 85,
                "evidence_seeking_quality": 91,
                "learning_extraction_quality": 83,
            },
            strengths=[
                "Anchored the conversation in a recent workflow example.",
                "Used behavioral follow-ups instead of feature pitching.",
                "Created enough space for concrete friction to surface.",
            ],
            mistakes=[
                "Could probe frequency and severity more explicitly.",
                "Could ask one more question about downstream impact.",
                "Could close on current workaround switching behavior.",
            ],
            evidence=[
                ReportEvidence(
                    quote="Tell me about the last time this workflow slowed you down.",
                    insight="The opener anchors the discussion in a specific past event.",
                    speaker="user",
                ),
                ReportEvidence(
                    quote="Yesterday I had to stitch notes manually before a stakeholder meeting.",
                    insight="The answer gives a concrete pain point and recent context.",
                    speaker="simulated_persona",
                ),
            ],
            next_steps=[
                "Ask what happened right before the slowdown.",
                "Quantify how often the manual stitching occurs.",
                "Probe what they do today instead of ideal future behavior.",
            ],
        ),
    )

    complete = client.post(
        f"/sessions/{session_id}/complete",
        json={
            "transcript": [
                {
                    "speaker": "user",
                    "text": "Tell me about the last time this workflow slowed you down.",
                    "started_at": "2026-04-25T09:00:00Z",
                    "ended_at": "2026-04-25T09:00:04Z",
                },
                {
                    "speaker": "simulated_persona",
                    "text": "Yesterday I had to stitch notes manually before a stakeholder meeting.",
                    "started_at": "2026-04-25T09:00:05Z",
                    "ended_at": "2026-04-25T09:00:09Z",
                },
            ]
        },
    )

    assert complete.status_code == 200

    report = client.get(f"/sessions/{session_id}/report")
    assert report.status_code == 200
    data = report.json()
    assert data["overall_score"] > 0
    assert len(data["evidence"]) >= 2


def test_realtime_token_uses_wiro_bootstrap(monkeypatch) -> None:
    services.session_store._sessions.clear()
    session_response = client.post(
        "/sessions",
        json={
            "task": "ai-study-planner-validation",
            "scenario": "fake_interest",
            "locale": "en-US",
        },
    )
    session_id = session_response.json()["id"]

    monkeypatch.setattr(
        services,
        "create_wiro_realtime_session",
        lambda session: ("task-123", "socket-token-abc"),
    )

    realtime = client.post(f"/sessions/{session_id}/realtime-token")

    assert realtime.status_code == 200
    payload = realtime.json()
    assert payload["provider"] == "wiro"
    assert payload["task_id"] == "task-123"
    assert payload["ephemeral_token"] == "socket-token-abc"
    assert payload["websocket_url"] == "wss://socket.wiro.ai/v1"
