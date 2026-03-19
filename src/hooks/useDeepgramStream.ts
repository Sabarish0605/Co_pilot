import { useState, useRef, useCallback, useEffect } from 'react';

// Configuration for debounce (End of Speech Detection)
const END_OF_SPEECH_WAIT_MS = 2000; // 2.0 seconds of silence/inactivity

interface UseDeepgramStreamProps {
  onTranscriptReceived?: (text: string, isFinal: boolean) => void;
}

export const useDeepgramStream = ({ onTranscriptReceived }: UseDeepgramStreamProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "connecting">("disconnected");
  
  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Buffer and timer for debouncing/finalizing turns
  const aggregatedTranscript = useRef("");
  const finalizeTimeout = useRef<NodeJS.Timeout | null>(null);

  const stopStreaming = useCallback(() => {
    // Clear any pending finalization on stop
    if (finalizeTimeout.current) {
      clearTimeout(finalizeTimeout.current);
    }
    
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    setConnectionStatus("disconnected");
  }, []);

  const startStreaming = async () => {
    setConnectionStatus("connecting");

    try {
      // 1. Fetch short-lived token from backend
      const tokenResp = await fetch('/api/deepgram/token');
      const tokenData = await tokenResp.json();
      const token = tokenData.token;

      if (!token) {
        throw new Error(tokenData.error || "Failed to retrieve Deepgram token");
      }

      // 2. Initialize WebSocket
      const url = "wss://api.deepgram.com/v1/listen?model=nova-3&encoding=linear16&sample_rate=16000&channels=1&interim_results=true&smart_format=true&endpointing=500"; // Deepgram's internal endpointing
      socketRef.current = new WebSocket(url, ["token", token]);
      
      socketRef.current.onopen = () => {
        console.log("Deepgram connected");
        setConnectionStatus("connected");
        setIsRecording(true);
      };

      socketRef.current.onmessage = (message) => {
        const data = JSON.parse(message.data);
        const receivedTranscript = data.channel?.alternatives[0]?.transcript;
        
        if (receivedTranscript && receivedTranscript.trim().length > 0) {
          if (data.is_final) {
            // A segment is finalized by Deepgram
            // 1. Add to our local aggregator
            aggregatedTranscript.current += (aggregatedTranscript.current ? " " : "") + receivedTranscript;
            
            // 2. Notify about the current "progress" but don't finalize yet
            if (onTranscriptReceived) {
              onTranscriptReceived(aggregatedTranscript.current, false);
            }

            // 3. Reset the "End of Speech" timer
            if (finalizeTimeout.current) clearTimeout(finalizeTimeout.current);
            
            finalizeTimeout.current = setTimeout(() => {
              const fullText = aggregatedTranscript.current.trim();
              if (fullText && onTranscriptReceived) {
                console.log("Finalizing customer turn after delay:", fullText);
                onTranscriptReceived(fullText, true);
              }
              aggregatedTranscript.current = "";
            }, END_OF_SPEECH_WAIT_MS);

          } else {
            // Interim result (live typing preview)
            // Show combined history + interim
            const previewText = (aggregatedTranscript.current + " " + receivedTranscript).trim();
            if (onTranscriptReceived) {
              onTranscriptReceived(previewText, false);
            }
          }
        }
      };

      socketRef.current.onerror = (error) => {
        console.error("Deepgram Error:", error);
        stopStreaming();
      };
      
      socketRef.current.onclose = () => {
        console.log("Deepgram connection closed");
        stopStreaming();
      };

      // 3. Initialize Audio
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      audioContextRef.current = new AudioContextClass({
        sampleRate: 16000,
      });

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(2048, 1, 1);
      
      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      processor.onaudioprocess = (e) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          setAudioLevel(Math.sqrt(sum / inputData.length));
          
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
          }
          
          socketRef.current.send(pcmData.buffer);
        }
      };

      processorRef.current = processor;

    } catch (err) {
      console.error("Failed to start streaming:", err);
      stopStreaming();
      alert(err instanceof Error ? err.message : "Voice connection failed");
    }
  };

  useEffect(() => {
    return () => stopStreaming();
  }, [stopStreaming]);

  return {
    isRecording,
    transcript,
    audioLevel,
    connectionStatus,
    startStreaming,
    stopStreaming,
    clearTranscript: () => {
      setTranscript("");
      aggregatedTranscript.current = "";
    }
  };
};
