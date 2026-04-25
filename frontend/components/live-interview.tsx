"use client";

import { InterviewMode } from "../lib/realtime-session";
import {
  LiveTranscriptPartial,
  ReportResponse,
  SessionResponse,
  TranscriptTurn,
  Visual
} from "../lib/types";

type LiveInterviewProps = {
  session: SessionResponse;
  visuals: Visual[];
  transcript: TranscriptTurn[];
  livePartial: LiveTranscriptPartial;
  interviewMode: InterviewMode;
  onEndCall: () => void;
  report: ReportResponse | null;
};

const modeLabels: Record<InterviewMode, string> = {
  "visual-generation-pending": "Gorseller bekleniyor",
  "realtime-connecting": "Canli ses baglantisi kuruluyor",
  "mic-active": "Mikrofon acik",
  "ai-speaking": "Yapay zeka konusuyor",
  "user-speaking": "Kullanici konusuyor",
  reconnecting: "Yeniden baglaniyor",
  "report-generating": "Rapor hazirlaniyor"
};

const scenarioLabels: Record<SessionResponse["scenario"], string> = {
  motivasyon: "Mahir / Hacettepe Universitesi",
  fake_interest: "Huseyin / Ankara Ataturk Lisesi",
  hard_mode: "Ulas / Bozyazi Anadolu Lisesi"
};

export function LiveInterview({
  session,
  visuals: _visuals,
  transcript,
  livePartial,
  interviewMode,
  onEndCall,
  report
}: LiveInterviewProps) {
  const avatarSrc =
    interviewMode === "ai-speaking" ? "/avatar-talking.png" : "/avatar-idle.png";
  const avatarAlt =
    interviewMode === "ai-speaking"
      ? `${session.persona_name} konusuyor`
      : `${session.persona_name} dinliyor`;

  return (
    <section className="live-grid">
      <div className="panel stage-panel">
        <div className="stage-topbar">
          <div>
            <div className="eyebrow">CANLI GORUSME</div>
            <h2>{session.persona_name}</h2>
            <p>{session.persona_summary}</p>
          </div>
          <button type="button" className="ghost-button" onClick={onEndCall}>
            Gorusmeyi bitir
          </button>
        </div>

        <div className="stage-status-row">
          <span className={`mode-pill mode-${interviewMode.replaceAll("_", "-")}`}>
            {modeLabels[interviewMode]}
          </span>
          <span className="progress-copy">{scenarioLabels[session.scenario]}</span>
        </div>

        <div className="avatar-stage">
          <img
            alt={avatarAlt}
            className={`avatar-image ${
              interviewMode === "ai-speaking" ? "is-speaking" : "is-listening"
            }`}
            src={avatarSrc}
          />

          <div className="avatar-overlay-card">
            <span>Acilis cumlesi</span>
            <strong>{session.opening_line}</strong>
          </div>
        </div>

        <div className="score-preview">
          <div className="score-ring">
            <span>{report?.overall_score ?? "--"}</span>
          </div>
          <div>
            <h3>Gorusme ivmesi</h3>
            <p>
              Gorisme boyunca gercek kanitlari, takip sorularinin derinligini ve
              soru kalitesini izle.
            </p>
          </div>
        </div>
      </div>

      <aside className="panel transcript-panel">
        <div className="transcript-header">
          <div>
            <div className="eyebrow">CANLI DOKUM</div>
            <h3>Konusma akisi</h3>
          </div>
          <span>{transcript.length} tur</span>
        </div>

        <div className="transcript-list">
          {transcript.map((turn, index) => (
            <article
              key={`${turn.started_at}-${index}`}
              className={`transcript-turn ${turn.speaker}`}
            >
              <span>{turn.speaker === "user" ? "Sen" : session.persona_name}</span>
              <p>{turn.text}</p>
            </article>
          ))}
          {livePartial ? (
            <article className={`transcript-turn ${livePartial.speaker}`}>
              <span>{livePartial.speaker === "user" ? "Sen" : session.persona_name}</span>
              <p>{livePartial.text}</p>
            </article>
          ) : null}
        </div>
      </aside>
    </section>
  );
}
