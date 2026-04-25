"use client";

import { RealtimeTokenResponse, TranscriptTurn } from "./types";

export type InterviewMode =
  | "visual-generation-pending"
  | "realtime-connecting"
  | "mic-active"
  | "ai-speaking"
  | "user-speaking"
  | "reconnecting"
  | "report-generating";

type RealtimeCallbacks = {
  onModeChange: (mode: InterviewMode) => void;
  onFinalTranscript: (turn: TranscriptTurn) => void;
  onPartialTranscript: (
    partial: { speaker: "user" | "simulated_persona"; text: string } | null
  ) => void;
  onError: (message: string) => void;
};

type JsonMessage = {
  type?: string;
  message?: string;
  text?: string;
  delta?: string;
  final?: boolean;
  is_final?: boolean;
  speaker?: string;
  role?: string;
  event?: string;
  pexit?: string;
  error?: string;
};

const AUDIO_SAMPLE_RATE = 24_000;
const CHUNK_SAMPLES = 4_800;
const MAX_RECONNECT_ATTEMPTS = 2;
const START_TIMEOUT_MS = 8_000;

function toIso(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function normalizeSpeaker(raw: string | undefined): "user" | "simulated_persona" | null {
  if (!raw) {
    return null;
  }

  const normalized = raw.toLowerCase();
  if (normalized.includes("user") || normalized.includes("human")) {
    return "user";
  }
  if (normalized.includes("ai") || normalized.includes("assistant") || normalized.includes("persona")) {
    return "simulated_persona";
  }
  return null;
}

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index] ?? 0));
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

function int16ToFloat32(buffer: ArrayBuffer): Float32Array {
  const view = new DataView(buffer);
  const output = new Float32Array(buffer.byteLength / 2);

  for (let index = 0; index < output.length; index += 1) {
    output[index] = view.getInt16(index * 2, true) / 0x8000;
  }

  return output;
}

function buildAudioFrame(taskToken: string, pcm: Int16Array): ArrayBuffer {
  const tokenBytes = new TextEncoder().encode(`${taskToken}|`);
  const pcmBytes = new Uint8Array(pcm.buffer);
  const payload = new Uint8Array(tokenBytes.length + pcmBytes.length);
  payload.set(tokenBytes, 0);
  payload.set(pcmBytes, tokenBytes.length);
  return payload.buffer;
}

function extractBinaryAudioFrame(taskToken: string, payload: ArrayBuffer): ArrayBuffer | null {
  const bytes = new Uint8Array(payload);
  const delimiter = "|".charCodeAt(0);
  const separatorIndex = bytes.indexOf(delimiter);

  if (separatorIndex === -1) {
    return payload;
  }

  const token = new TextDecoder().decode(bytes.slice(0, separatorIndex));
  if (token !== taskToken) {
    return null;
  }

  return bytes.slice(separatorIndex + 1).buffer;
}

async function createPcmWorklet(audioContext: AudioContext): Promise<AudioWorkletNode> {
  const processorSource = `
    class PCMChunkProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
        this.buffer = [];
        this.chunkSize = ${CHUNK_SAMPLES};
      }

      process(inputs) {
        const input = inputs[0]?.[0];
        if (!input) {
          return true;
        }

        for (let index = 0; index < input.length; index += 1) {
          this.buffer.push(input[index]);
        }

        while (this.buffer.length >= this.chunkSize) {
          const chunk = this.buffer.slice(0, this.chunkSize);
          this.buffer = this.buffer.slice(this.chunkSize);
          this.port.postMessage(new Float32Array(chunk));
        }

        return true;
      }
    }

    registerProcessor("pcm-chunk-processor", PCMChunkProcessor);
  `;

  const blob = new Blob([processorSource], { type: "text/javascript" });
  const blobUrl = URL.createObjectURL(blob);

  try {
    await audioContext.audioWorklet.addModule(blobUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }

  return new AudioWorkletNode(audioContext, "pcm-chunk-processor");
}

export class RealtimeSessionController {
  private readonly bootstrap: RealtimeTokenResponse;
  private readonly callbacks: RealtimeCallbacks;
  private websocket: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaSource: MediaStreamAudioSourceNode | null = null;
  private processorNode: AudioWorkletNode | null = null;
  private playbackCursor = 0;
  private reconnectAttempts = 0;
  private streamReady = false;
  private ended = false;
  private readyResolver: (() => void) | null = null;
  private readyRejector: ((reason?: unknown) => void) | null = null;
  private readyTimeoutId: number | null = null;
  private currentUserTurnStartedAt: number | null = null;
  private currentAiTurnStartedAt: number | null = null;

  constructor(bootstrap: RealtimeTokenResponse, callbacks: RealtimeCallbacks) {
    this.bootstrap = bootstrap;
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    this.callbacks.onModeChange("realtime-connecting");
    this.audioContext = new AudioContext({
      sampleRate: AUDIO_SAMPLE_RATE,
      latencyHint: "interactive"
    });

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    this.mediaSource = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processorNode = await createPcmWorklet(this.audioContext);
    this.mediaSource.connect(this.processorNode);

    this.processorNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN || !this.streamReady) {
        return;
      }

      const chunk = event.data;
      const pcm = floatTo16BitPCM(chunk);
      const payload = buildAudioFrame(this.bootstrap.ephemeral_token, pcm);
      this.websocket.send(payload);
    };

    return new Promise<void>((resolve, reject) => {
      this.readyResolver = resolve;
      this.readyRejector = reject;
      this.readyTimeoutId = window.setTimeout(() => {
        if (!this.streamReady && !this.ended) {
          this.readyRejector?.(
            new Error("Canli baglanti zaman asimina ugradi. Lutfen tekrar dene.")
          );
          this.readyRejector = null;
          void this.dispose();
        }
      }, START_TIMEOUT_MS);
      this.connectSocket();
    });
  }

  async end(): Promise<void> {
    this.ended = true;
    this.streamReady = false;
    if (this.readyTimeoutId) {
      window.clearTimeout(this.readyTimeoutId);
      this.readyTimeoutId = null;
    }

    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(
        JSON.stringify({
          type: "task_session_end",
          tasktoken: this.bootstrap.ephemeral_token
        })
      );
    }

    window.setTimeout(() => {
      void this.dispose();
    }, 800);
  }

  async dispose(): Promise<void> {
    this.ended = true;
    this.streamReady = false;

    if (this.websocket) {
      this.websocket.onclose = null;
      this.websocket.onerror = null;
      this.websocket.onmessage = null;
      this.websocket.onopen = null;
      if (this.websocket.readyState === WebSocket.OPEN || this.websocket.readyState === WebSocket.CONNECTING) {
        this.websocket.close();
      }
      this.websocket = null;
    }

    if (this.processorNode) {
      this.processorNode.port.onmessage = null;
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.mediaSource) {
      this.mediaSource.disconnect();
      this.mediaSource = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      await this.audioContext.close();
    }

    this.audioContext = null;
    this.playbackCursor = 0;
    this.callbacks.onPartialTranscript(null);
  }

  private connectSocket() {
    const socket = new WebSocket(this.bootstrap.websocket_url);
    socket.binaryType = "arraybuffer";

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: "task_info",
          tasktoken: this.bootstrap.ephemeral_token
        })
      );
    };

    socket.onmessage = async (event) => {
      if (typeof event.data === "string") {
        this.handleJsonMessage(event.data);
        return;
      }

      const arrayBuffer =
        event.data instanceof ArrayBuffer ? event.data : await (event.data as Blob).arrayBuffer();
      this.handleBinaryMessage(arrayBuffer);
    };

    socket.onerror = () => {
      if (!this.streamReady && this.readyRejector) {
        this.readyRejector(new Error("Canli ses baglantisi kurulurken websocket hatasi olustu."));
        this.readyRejector = null;
      }
    };

    socket.onclose = () => {
      this.websocket = null;

      if (this.ended) {
        return;
      }

      if (!this.streamReady && this.readyRejector) {
        this.readyRejector(new Error("Canli ses baglantisi baslatilamadi."));
        this.readyRejector = null;
        return;
      }

      if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        this.callbacks.onError("Canli baglanti koptu. Lutfen yeniden dene.");
        this.callbacks.onModeChange("reconnecting");
        void this.dispose();
        return;
      }

      this.reconnectAttempts += 1;
      this.streamReady = false;
      this.callbacks.onModeChange("reconnecting");
      window.setTimeout(() => {
        if (!this.ended) {
          this.connectSocket();
        }
      }, 1000 * this.reconnectAttempts);
    };

    this.websocket = socket;
  }

  private handleJsonMessage(raw: string) {
    let payload: JsonMessage;

    try {
      payload = JSON.parse(raw) as JsonMessage;
    } catch {
      return;
    }

    const messageType = payload.type ?? payload.event ?? "";

    if (messageType === "task_stream_ready" || messageType === "session.opened") {
      this.reconnectAttempts = 0;
      this.streamReady = true;
      if (this.readyTimeoutId) {
        window.clearTimeout(this.readyTimeoutId);
        this.readyTimeoutId = null;
      }
      this.callbacks.onModeChange("mic-active");
      if (this.readyResolver) {
        this.readyResolver();
        this.readyResolver = null;
        this.readyRejector = null;
      }
      return;
    }

    if (messageType === "task_stream_end" || messageType === "output_audio.stopped") {
      this.callbacks.onModeChange("mic-active");
      this.callbacks.onPartialTranscript(null);
      return;
    }

    if (messageType === "task_end" || messageType === "session.closed") {
      void this.dispose();
      return;
    }

    if (messageType === "error" || payload.error || payload.pexit === "1") {
      this.callbacks.onError(payload.error ?? "Canli gorusme sirasinda bir hata olustu.");
      return;
    }

    const transcript = this.extractTranscriptPayload(payload);
    if (transcript) {
      const timestamp = Date.now();
      const startedAt =
        transcript.speaker === "user"
          ? this.currentUserTurnStartedAt ?? timestamp
          : this.currentAiTurnStartedAt ?? timestamp;

      if (transcript.final) {
        this.callbacks.onPartialTranscript(null);
        this.callbacks.onFinalTranscript({
          speaker: transcript.speaker,
          text: transcript.text,
          started_at: toIso(startedAt),
          ended_at: toIso(timestamp)
        });
        if (transcript.speaker === "user") {
          this.currentUserTurnStartedAt = null;
          this.callbacks.onModeChange("ai-speaking");
        } else {
          this.currentAiTurnStartedAt = null;
          this.callbacks.onModeChange("mic-active");
        }
      } else {
        if (transcript.speaker === "user" && this.currentUserTurnStartedAt === null) {
          this.currentUserTurnStartedAt = timestamp;
        }
        if (transcript.speaker === "simulated_persona" && this.currentAiTurnStartedAt === null) {
          this.currentAiTurnStartedAt = timestamp;
        }
        this.callbacks.onPartialTranscript({
          speaker: transcript.speaker,
          text: transcript.text
        });
        this.callbacks.onModeChange(
          transcript.speaker === "user" ? "user-speaking" : "ai-speaking"
        );
      }
    }
  }

  private extractTranscriptPayload(payload: JsonMessage): {
    speaker: "user" | "simulated_persona";
    text: string;
    final: boolean;
  } | null {
    const candidate = payload.message ?? payload.text ?? payload.delta;
    const speaker = normalizeSpeaker(payload.speaker ?? payload.role);

    if (typeof candidate === "string") {
      if (candidate.startsWith("TRANSCRIPT_USER:")) {
        return {
          speaker: "user",
          text: candidate.replace("TRANSCRIPT_USER:", "").trim(),
          final: true
        };
      }

      if (candidate.startsWith("TRANSCRIPT_AI:")) {
        return {
          speaker: "simulated_persona",
          text: candidate.replace("TRANSCRIPT_AI:", "").trim(),
          final: true
        };
      }

      if (speaker) {
        return {
          speaker,
          text: candidate.trim(),
          final: Boolean(payload.final ?? payload.is_final)
        };
      }
    }

    return null;
  }

  private handleBinaryMessage(payload: ArrayBuffer) {
    if (!this.audioContext) {
      return;
    }

    const audioBytes = extractBinaryAudioFrame(this.bootstrap.ephemeral_token, payload);
    if (!audioBytes || audioBytes.byteLength === 0) {
      return;
    }

    const samples = int16ToFloat32(audioBytes);
    const buffer = this.audioContext.createBuffer(1, samples.length, AUDIO_SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    const startAt = Math.max(this.audioContext.currentTime + 0.02, this.playbackCursor);
    source.start(startAt);
    this.playbackCursor = startAt + buffer.duration;
    this.callbacks.onModeChange("ai-speaking");
  }
}
