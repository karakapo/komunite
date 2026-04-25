"use client";

import { Difficulty } from "../lib/types";

type ScenarioOption = {
  id: string;
  title: string;
  kicker: string;
  role: string;
  focus: string;
  difficultyLabel: string;
};

type IntroPanelProps = {
  difficulty: Difficulty;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onStart: () => void;
  starting: boolean;
  visualsLoading: boolean;
};

const scenarioOptions: ScenarioOption[] = [
  {
    id: "ai-assistant-validation",
    title: "AI Assistant Workflow",
    kicker: "Discovery interview",
    role: "You are a PM testing whether an AI assistant truly helps daily work.",
    focus: "Ask about last real workflows, pain points, and switching triggers.",
    difficultyLabel: "Medium"
  },
  {
    id: "meeting-notes-copilot",
    title: "Meeting Notes Copilot",
    kicker: "Coming soon",
    role: "You will validate note capture and summary behavior in real meetings.",
    focus: "Keep this one locked for now.",
    difficultyLabel: "Soon"
  },
  {
    id: "internal-search-agent",
    title: "Internal Search Agent",
    kicker: "Coming soon",
    role: "You will explore how teams retrieve buried knowledge across tools.",
    focus: "Keep this one locked for now.",
    difficultyLabel: "Soon"
  }
];

export function IntroPanel({
  difficulty,
  onDifficultyChange,
  onStart,
  starting,
  visualsLoading
}: IntroPanelProps) {
  const activeScenario = scenarioOptions[0];

  return (
    <section className="panel hero-panel">
      <div className="eyebrow">WIRO AI / SCENARIO SELECT</div>
      <h1 className="hero-title">Pick a scenario and jump into the interview.</h1>
      <p className="hero-copy">
        More scenarios will live here. For now, one scenario is open and ready.
      </p>

      <div className="scenario-strip">
        {scenarioOptions.map((scenario, index) => {
          const isActive = index === 0;

          return (
            <button
              key={scenario.id}
              className={`scenario-chip ${isActive ? "is-active" : "is-muted"}`}
              type="button"
              aria-expanded={isActive}
              onClick={() => {
                if (isActive) {
                  onDifficultyChange(difficulty);
                }
              }}
            >
              <span className="scenario-chip-kicker">{scenario.kicker}</span>
              <strong className="scenario-chip-title">{scenario.title}</strong>
              <small className="scenario-chip-badge">{scenario.difficultyLabel}</small>
            </button>
          );
        })}
      </div>

      <div className="scenario-detail">
        <div className="scenario-detail-card role-card">
          <span>Our role</span>
          <strong>{activeScenario.role}</strong>
        </div>

        <div className="scenario-detail-card">
          <span>Focus</span>
          <p>{activeScenario.focus}</p>
        </div>

        <div className="scenario-detail-card compact">
          <span>Difficulty</span>
          <strong>{difficulty === "easy" ? "Easy" : difficulty === "hard" ? "Hard" : "Medium"}</strong>
        </div>
      </div>

      <div className="difficulty-strip">
        {(["easy", "medium", "hard"] as Difficulty[]).map((option) => (
          <button
            key={option}
            className={`difficulty-pill ${option === difficulty ? "is-active" : ""}`}
            onClick={() => onDifficultyChange(option)}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>

      <div className="cta-row">
        <button className="primary-button" onClick={onStart} disabled={starting}>
          {starting ? "Preparing session..." : "Start interview"}
        </button>
        <div className="background-status">
          <span className={`status-dot ${visualsLoading ? "pending" : "ready"}`} />
          {visualsLoading ? "Preparing visuals" : "Visuals ready"}
        </div>
      </div>
    </section>
  );
}
