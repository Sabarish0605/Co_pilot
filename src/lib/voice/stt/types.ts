export type STTProvider = "online" | "offline";

export interface TranscriptEvent {
  text: string;
  isFinal: boolean;
  confidence?: number;
  provider: STTProvider;
  latencyMs?: number;
  timestamp?: string;
}

export interface STTState {
  isRecording: boolean;
  transcript: string;
  audioLevel: number;
  connectionStatus: "connected" | "disconnected" | "connecting";
  provider: STTProvider;
}
