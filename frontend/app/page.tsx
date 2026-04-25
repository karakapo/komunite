"use client";

import { useEffect, useRef, useState } from "react";
import { IntroPanel } from "../components/intro-panel";
import { LiveInterview } from "../components/live-interview";
import { ReportPanel } from "../components/report-panel";
import {
  completeSession,
  createSession,
  fetchRealtimeToken,
  fetchReport,
  fetchVisuals
} from "../lib/api";
import {
  Difficulty,
  ReportResponse,
  SessionResponse,
  TranscriptTurn,
  Visual
} from "../lib/types";

type AppStage = "intro" | "live" | "report";
type InterviewMode =
  | "visual-generation-pending"
  | "realtime-connecting"
  | "mic-active"
  | "ai-speaking"
  | "user-speaking"
  | "reconnecting"
  | "report-generating";

const seededTranscript: TranscriptTurn[] = [
  {
    speaker: "simulated_persona",
    text: "Most weeks I juggle customer notes across Slack, Notion, and screenshots before I summarize anything.",
    started_at: new Date().toISOString(),
    ended_at: new Date().toISOString()
  },
  {
    speaker: "user",
    text: "Tell me about the last time that workflow slowed you down.",
    started_at: new Date().toISOString(),
    ended_at: new Date().toISOString()
  },
  {
    speaker: "simulated_persona",
    text: "Yesterday I had to pull three call snippets manually because I could not trust the auto summary enough to share it.",
    started_at: new Date().toISOString(),
    ended_at: new Date().toISOString()
  }
];

export default function Home() {
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [stage, setStage] = useState<AppStage>("intro");
  const [starting, setStarting] = useState(false);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [visuals, setVisuals] = useState<Visual[]>([]);
  const [interviewMode, setInterviewMode] =
    useState<InterviewMode>("visual-generation-pending");
  const [transcript, setTranscript] = useState<TranscriptTurn[]>(seededTranscript);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const visualsPollingRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (visualsPollingRef.current) {
        window.clearInterval(visualsPollingRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (stage !== "intro") {
      return;
    }

    let active = true;

    async function prepareSession() {
      try {
        setError(null);
        const nextSession = await createSession({
          difficulty,
          task: "ai-assistant-validation",
          locale: "en-US"
        });

        if (!active) {
          return;
        }

        setSession(nextSession);
        await hydrateVisuals(nextSession.id);
      } catch (nextError) {
        if (!active) {
          return;
        }
        setError(nextError instanceof Error ? nextError.message : "Unknown error");
      }
    }

    void prepareSession();

    return () => {
      active = false;
    };
  }, [difficulty, stage]);

  async function hydrateVisuals(sessionId: string) {
    if (visualsPollingRef.current) {
      window.clearInterval(visualsPollingRef.current);
      visualsPollingRef.current = null;
    }

    const updateVisuals = async () => {
      const next = await fetchVisuals(sessionId);
      setVisuals(next);

      if (next.every((item) => item.status === "ready")) {
        if (visualsPollingRef.current) {
          window.clearInterval(visualsPollingRef.current);
          visualsPollingRef.current = null;
        }
      }
    };

    await updateVisuals();

    if (!visualsPollingRef.current) {
      visualsPollingRef.current = window.setInterval(() => {
        void updateVisuals();
      }, 2200);
    }
  }

  async function handleStart() {
    if (!session) {
      return;
    }

    setError(null);
    setStarting(true);

    try {
      setInterviewMode("visual-generation-pending");
      await fetchRealtimeToken(session.id);
      setInterviewMode("realtime-connecting");
      setStage("live");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unknown error");
    } finally {
      setStarting(false);
    }
  }

  async function handleEndCall() {
    if (!session) {
      return;
    }

    setInterviewMode("report-generating");

    try {
      await completeSession(session.id, transcript);
      const nextReport = await fetchReport(session.id);
      setReport(nextReport);
      setStage("report");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unknown error");
    }
  }

  const visualsLoading =
    visuals.length === 0 || visuals.some((visual) => visual.status === "pending");

  return (
    <main className="page-shell">
      <div className="mesh mesh-a" />
      <div className="mesh mesh-b" />

      <div className="content-shell">
        {stage === "intro" && (
          <IntroPanel
            difficulty={difficulty}
            onDifficultyChange={setDifficulty}
            onStart={handleStart}
            starting={starting || !session}
            visualsLoading={visualsLoading}
          />
        )}

        {stage === "live" && session && (
          <LiveInterview
            session={session}
            visuals={visuals}
            transcript={transcript}
            interviewMode={interviewMode}
            onModeChange={setInterviewMode}
            onEndCall={handleEndCall}
            report={report}
          />
        )}

        {stage === "report" && report && <ReportPanel report={report} />}

        {error ? <p className="error-banner">{error}</p> : null}
      </div>
    </main>
  );
}
