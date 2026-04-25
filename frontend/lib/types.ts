export type Scenario = "motivasyon" | "fake_interest" | "hard_mode";

export type SessionResponse = {
  id: string;
  task: string;
  scenario: Scenario;
  locale: string;
  persona_name: string;
  persona_summary: string;
  opening_line: string;
  visual_status: "pending" | "ready";
};

export type RealtimeTokenResponse = {
  session_id: string;
  provider: string;
  websocket_url: string;
  ephemeral_token: string;
  voice_profile: string;
};

export type SessionEvent = {
  id: string;
  kind: string;
  message: string;
  created_at: string;
};

export type Visual = {
  pose_index: number;
  status: "pending" | "ready";
  image_url: string | null;
};

export type TranscriptTurn = {
  speaker: "user" | "simulated_persona";
  text: string;
  started_at: string;
  ended_at: string;
};

export type LiveTranscriptPartial = {
  speaker: "user" | "simulated_persona";
  text: string;
} | null;

export type ReportEvidence = {
  quote: string;
  insight: string;
  speaker: "user" | "simulated_persona";
};

export type ReportResponse = {
  overall_score: number;
  category_scores: Record<string, number>;
  strengths: string[];
  mistakes: string[];
  evidence: ReportEvidence[];
  next_steps: string[];
};
