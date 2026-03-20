import { useState, useCallback, useEffect, useRef } from 'react';
import { STTProvider } from '@/lib/voice/stt/types';
import { useDeepgramStream } from './useDeepgramStream';

interface UseSTTPipelineProps {
  provider: STTProvider;
  onTranscriptReceived: (text: string, isFinal: boolean, provider: STTProvider) => void;
}

export const useSTTPipeline = ({ provider, onTranscriptReceived }: UseSTTPipelineProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "connecting">("disconnected");
  const [audioLevel, setAudioLevel] = useState(0);

  const offlineSocketRef = useRef<WebSocket | null>(null);
  const onTranscriptRef = useRef(onTranscriptReceived);

  useEffect(() => {
    onTranscriptRef.current = onTranscriptReceived;
  }, [onTranscriptReceived]);

  // Online STT (Deepgram)
  const onlineSTT = useDeepgramStream({
    onTranscriptReceived: (text, isFinal) => {
      if (provider === "online") {
        onTranscriptRef.current(text, isFinal, "online");
      }
    }
  });

  const stopOffline = useCallback(() => {
    if (offlineSocketRef.current) {
      offlineSocketRef.current.close();
      offlineSocketRef.current = null;
    }
    setConnectionStatus("disconnected");
    setIsRecording(false);
    setAudioLevel(0);
  }, []);

  const startOffline = useCallback(() => {
    setConnectionStatus("connecting");
    // Use the backend host but with ws protocol. Port 8000 is default for the python backend.
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const wsUrl = `ws://${host}:8000/ws/stt`;
    
    try {
      const socket = new WebSocket(wsUrl);
      offlineSocketRef.current = socket;

      socket.onopen = () => {
        setConnectionStatus("connected");
        setIsRecording(true);
        setAudioLevel(0.02); // Small indicative level
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (provider === "offline") {
          onTranscriptRef.current(data.text, data.isFinal, "offline");
          // Visual feedback for audio activity
          setAudioLevel(0.08);
          setTimeout(() => setAudioLevel(0.02), 500);
        }
      };

      socket.onclose = () => stopOffline();
      socket.onerror = () => stopOffline();
    } catch (err) {
      console.error("Offline STT connection failed:", err);
      stopOffline();
    }
  }, [provider, stopOffline]);

  const startStreaming = useCallback(async () => {
    if (provider === "online") {
      await onlineSTT.startStreaming();
    } else {
      startOffline();
    }
  }, [provider, onlineSTT, startOffline]);

  const stopStreaming = useCallback(() => {
    if (provider === "online") {
      onlineSTT.stopStreaming();
    } else {
      stopOffline();
    }
  }, [provider, onlineSTT, stopOffline]);

  // Sync internal state with active provider
  useEffect(() => {
    if (provider === "online") {
      setIsRecording(onlineSTT.isRecording);
      setConnectionStatus(onlineSTT.connectionStatus);
      setAudioLevel(onlineSTT.audioLevel);
    }
  }, [provider, onlineSTT.isRecording, onlineSTT.connectionStatus, onlineSTT.audioLevel]);

  return {
    isRecording,
    connectionStatus,
    startStreaming,
    stopStreaming,
    audioLevel
  };
};
