"use client";

import { ReportResponse } from "../lib/types";

type ReportPanelProps = {
  report: ReportResponse;
};

export function ReportPanel({ report }: ReportPanelProps) {
  return (
    <section className="panel report-panel">
      <div className="report-head">
        <div>
          <div className="eyebrow">POST CALL REPORT</div>
          <h2>How well you applied The Mom Test</h2>
        </div>
        <div className="report-score">{report.overall_score}</div>
      </div>

      <div className="report-grid">
        <div className="report-column">
          <h3>Category scores</h3>
          <div className="score-list">
            {Object.entries(report.category_scores).map(([category, score]) => (
              <div key={category} className="score-row">
                <span>{category.replaceAll("_", " ")}</span>
                <strong>{score}</strong>
              </div>
            ))}
          </div>

          <h3>Strengths</h3>
          <ul>
            {report.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="report-column">
          <h3>What to improve</h3>
          <ul>
            {report.mistakes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h3>Next steps</h3>
          <ul>
            {report.next_steps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="evidence-block">
        <h3>Evidence from transcript</h3>
        <div className="evidence-list">
          {report.evidence.map((item) => (
            <article key={`${item.speaker}-${item.quote}`} className="evidence-card">
              <span>{item.speaker === "user" ? "User evidence" : "Persona context"}</span>
              <strong>{item.quote}</strong>
              <p>{item.insight}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
