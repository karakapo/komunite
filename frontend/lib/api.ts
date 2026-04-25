import {
  ReportResponse,
  RealtimeTokenResponse,
  Scenario,
  SessionEvent,
  SessionResponse,
  TranscriptTurn,
  Visual
} from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }

  return (await response.json()) as T;
}

export async function createSession(input: {
  task: string;
  scenario: Scenario;
  locale: string;
}): Promise<SessionResponse> {
  return request<SessionResponse>("/sessions", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function fetchRealtimeToken(
  sessionId: string
): Promise<RealtimeTokenResponse> {
  return request<RealtimeTokenResponse>(`/sessions/${sessionId}/realtime-token`, {
    method: "POST"
  });
}

export async function fetchEvents(sessionId: string): Promise<SessionEvent[]> {
  return request<SessionEvent[]>(`/sessions/${sessionId}/events`);
}

export async function fetchVisuals(sessionId: string): Promise<Visual[]> {
  return request<Visual[]>(`/sessions/${sessionId}/visuals`);
}

export async function completeSession(
  sessionId: string,
  transcript: TranscriptTurn[]
): Promise<{ status: string }> {
  return request<{ status: string }>(`/sessions/${sessionId}/complete`, {
    method: "POST",
    body: JSON.stringify({ transcript })
  });
}

export async function fetchReport(sessionId: string): Promise<ReportResponse> {
  return request<ReportResponse>(`/sessions/${sessionId}/report`);
}
