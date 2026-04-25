"use client";

import { useEffect, useRef, useState } from "react";
import { IntroPanel } from "../components/intro-panel";
import { LiveInterview } from "../components/live-interview";
import { ReportPanel } from "../components/report-panel";
import { InterviewMode, RealtimeSessionController } from "../lib/realtime-session";
import {
  completeSession,
  createSession,
  fetchRealtimeDebug,
  fetchRealtimeToken,
  fetchReport,
  fetchVisuals
} from "../lib/api";
import {
  LiveTranscriptPartial,
  ReportResponse,
  Scenario,
  SessionResponse,
  TranscriptTurn,
  Visual
} from "../lib/types";

type AppStage = "intro" | "live" | "report";

function shouldFetchRealtimeDebug(errorMessage: string): boolean {
  return (
    errorMessage.includes("zaman asimina ugradi") ||
    errorMessage.includes("task_end gonderdi") ||
    errorMessage.includes("websocket hatasi") ||
    errorMessage.includes("baglanti baslatilamadi")
  );
}

export default function Home() {
  const [scenario, setScenario] = useState<Scenario>("motivasyon");
  const [stage, setStage] = useState<AppStage>("intro");
  const [introStep, setIntroStep] = useState<"select" | "details">("select");
  const [starting, setStarting] = useState(false);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [visuals, setVisuals] = useState<Visual[]>([]);
  const [interviewMode, setInterviewMode] =
    useState<InterviewMode>("visual-generation-pending");
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [livePartial, setLivePartial] = useState<LiveTranscriptPartial>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const visualsPollingRef = useRef<number | null>(null);
  const realtimeControllerRef = useRef<RealtimeSessionController | null>(null);
  const transcriptRef = useRef<TranscriptTurn[]>([]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    return () => {
      if (visualsPollingRef.current) {
        window.clearInterval(visualsPollingRef.current);
      }

      void realtimeControllerRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (stage !== "intro") {
      return;
    }

    if (session && session.scenario === scenario) {
      return;
    }

    let active = true;

    async function prepareSession() {
      try {
        const nextSession = await createSession({
          task: "ai-study-planner-validation",
          scenario,
          locale: "tr-TR"
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
        setError(nextError instanceof Error ? nextError.message : "Bilinmeyen bir hata olustu");
      }
    }

    void prepareSession();

    return () => {
      active = false;
    };
  }, [scenario, session?.scenario, stage]);

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
      setTranscript([]);
      setLivePartial(null);
      setReport(null);
      setInterviewMode("visual-generation-pending");
      const bootstrap = await fetchRealtimeToken(session.id);
      const controller = new RealtimeSessionController(bootstrap, {
        onModeChange: setInterviewMode,
        onFinalTranscript: (turn) => {
          setTranscript((current) => [...current, turn]);
        },
        onPartialTranscript: setLivePartial,
        onError: (message) => setError(message)
      });

      realtimeControllerRef.current = controller;
      setStage("live");
      await controller.start();
    } catch (nextError) {
      let errorMessage =
        nextError instanceof Error ? nextError.message : "Bilinmeyen bir hata olustu";

      if (session && shouldFetchRealtimeDebug(errorMessage)) {
        try {
          const realtimeDebug = await fetchRealtimeDebug(session.id);
          const debugParts = [
            realtimeDebug.status ? `status=${realtimeDebug.status}` : null,
            realtimeDebug.pexit ? `pexit=${realtimeDebug.pexit}` : null,
            realtimeDebug.debugoutput ? `debug=${realtimeDebug.debugoutput}` : null,
            realtimeDebug.errors.length > 0 ? `errors=${realtimeDebug.errors.join(", ")}` : null
          ].filter(Boolean);

          if (debugParts.length > 0) {
            errorMessage = `${errorMessage} (${debugParts.join(" | ")})`;
          }
        } catch {
          // Keep the original startup error if the debug lookup also fails.
        }
      }

      void realtimeControllerRef.current?.dispose();
      realtimeControllerRef.current = null;
      setStage("intro");
      setError(errorMessage);
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
      await realtimeControllerRef.current?.end();
      await completeSession(session.id, transcriptRef.current);
      const nextReport = await fetchReport(session.id);
      setReport(nextReport);
      setStage("report");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Bilinmeyen bir hata olustu");
    } finally {
      realtimeControllerRef.current = null;
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
            scenario={scenario}
            flowStep={introStep}
            onScenarioChange={setScenario}
            onContinue={() => setIntroStep("details")}
            onBack={() => setIntroStep("select")}
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
            livePartial={livePartial}
            interviewMode={interviewMode}
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
