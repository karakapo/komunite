"use client";

import { useEffect, useMemo, useState } from "react";
import { ReportResponse, SessionResponse, TranscriptTurn, Visual } from "../lib/types";

type InterviewMode =
  | "visual-generation-pending"
  | "realtime-connecting"
  | "mic-active"
  | "ai-speaking"
  | "user-speaking"
  | "reconnecting"
  | "report-generating";

type LiveInterviewProps = {
  session: SessionResponse;
  visuals: Visual[];
  transcript: TranscriptTurn[];
  interviewMode: InterviewMode;
  onModeChange: (mode: InterviewMode) => void;
  onEndCall: () => void;
  report: ReportResponse | null;
};

const modeLabels: Record<InterviewMode, string> = {
  "visual-generation-pending": "Visuals pending",
  "realtime-connecting": "Connecting realtime voice",
  "mic-active": "Mic active",
  "ai-speaking": "AI speaking",
  "user-speaking": "User speaking",
  reconnecting: "Reconnecting",
  "report-generating": "Generating report"
};

export function LiveInterview({
  session,
  visuals,
  transcript,
  interviewMode,
  onModeChange,
  onEndCall,
  report
}: LiveInterviewProps) {
  const readyVisuals = useMemo(
    () => visuals.filter((visual) => visual.status === "ready" && visual.image_url),
    [visuals]
  );
  const [activePose, setActivePose] = useState(0);

  useEffect(() => {
    if (readyVisuals.length === 0 || interviewMode !== "ai-speaking") {
      return;
    }

    const interval = window.setInterval(() => {
      setActivePose((current) => (current + 1) % readyVisuals.length);
    }, 1150);

    return () => window.clearInterval(interval);
  }, [interviewMode, readyVisuals.length]);

  useEffect(() => {
    if (interviewMode === "realtime-connecting") {
      const timer = window.setTimeout(() => onModeChange("mic-active"), 1400);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [interviewMode, onModeChange]);

  const currentVisual = readyVisuals[activePose] ?? null;

  return (
    <section className="live-grid">
      <div className="panel stage-panel">
        <div className="stage-topbar">
          <div>
            <div className="eyebrow">LIVE INTERVIEW</div>
            <h2>{session.persona_name}</h2>
            <p>{session.persona_summary}</p>
          </div>
          <button type="button" className="ghost-button" onClick={onEndCall}>
            End call
          </button>
        </div>

        <div className="stage-status-row">
          <span className={`mode-pill mode-${interviewMode.replaceAll("_", "-")}`}>
            {modeLabels[interviewMode]}
          </span>
          <span className="progress-copy">
            Difficulty: {session.difficulty.toUpperCase()} / Score target: 80+
          </span>
        </div>

        <div className="avatar-stage">
          {currentVisual ? (
            <img
              alt={`Avatar pose ${currentVisual.pose_index + 1}`}
              className={`avatar-image ${
                interviewMode === "ai-speaking" ? "is-speaking" : "is-listening"
              }`}
              src={currentVisual.image_url ?? undefined}
            />
          ) : (
            <div className="avatar-placeholder">Preparing avatar poses...</div>
          )}

          <div className="avatar-overlay-card">
            <span>Opening line</span>
            <strong>{session.opening_line}</strong>
          </div>
        </div>

        <div className="control-row">
          <button
            type="button"
            className="secondary-button"
            onClick={() => onModeChange("user-speaking")}
          >
            Simulate user speaking
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => onModeChange("ai-speaking")}
          >
            Simulate AI response
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => onModeChange("reconnecting")}
          >
            Simulate reconnect
          </button>
        </div>

        <div className="score-preview">
          <div className="score-ring">
            <span>{report?.overall_score ?? "--"}</span>
          </div>
          <div>
            <h3>Session momentum</h3>
            <p>
              Track real evidence, follow-up depth, and question quality as the
              call unfolds.
            </p>
          </div>
        </div>
      </div>

      <aside className="panel transcript-panel">
        <div className="transcript-header">
          <div>
            <div className="eyebrow">LIVE TRANSCRIPT</div>
            <h3>Conversation stream</h3>
          </div>
          <span>{transcript.length} turns</span>
        </div>

        <div className="transcript-list">
          {transcript.map((turn, index) => (
            <article
              key={`${turn.started_at}-${index}`}
              className={`transcript-turn ${turn.speaker}`}
            >
              <span>{turn.speaker === "user" ? "You" : session.persona_name}</span>
              <p>{turn.text}</p>
            </article>
          ))}
        </div>
      </aside>
    </section>
  );
}
