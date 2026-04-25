from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_create_session_and_generate_visuals() -> None:
    response = client.post(
        "/sessions",
        json={"difficulty": "medium", "task": "ai-assistant-validation", "locale": "en-US"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["persona_name"] == "Mina Patel"
    assert payload["visual_status"] in {"pending", "ready"}

    visuals = client.get(f"/sessions/{payload['id']}/visuals")
    assert visuals.status_code == 200
    assert len(visuals.json()) == 3


def test_complete_session_creates_report() -> None:
    session_response = client.post(
        "/sessions",
        json={"difficulty": "hard", "task": "ai-assistant-validation", "locale": "en-US"},
    )
    session_id = session_response.json()["id"]

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
