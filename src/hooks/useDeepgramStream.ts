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

  // IMPORTANT: Keep the latest callback in a ref to avoid closure issues
  const onReceivedRef = useRef(onTranscriptReceived);
  useEffect(() => {
    onReceivedRef.current = onTranscriptReceived;
  }, [onTranscriptReceived]);

  const stopStreaming = useCallback(() => {
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
      const tokenResp = await fetch('/api/deepgram/token');
      const tokenData = await tokenResp.json();
      const token = tokenData.token;

      if (!token) throw new Error(tokenData.error || "Failed to retrieve Deepgram token");

      // Stable model (nova-2) for better results and reliability
      const url = "wss://api.deepgram.com/v1/listen?model=nova-2&encoding=linear16&sample_rate=16000&channels=1&interim_results=true&smart_format=true&endpointing=500";
      socketRef.current = new WebSocket(url, ["token", token]);
      
      socketRef.current.onopen = () => {
        setConnectionStatus("connected");
        setIsRecording(true);
      };

      socketRef.current.onmessage = (message) => {
        const data = JSON.parse(message.data);
        const receivedTranscript = data.channel?.alternatives[0]?.transcript;
        
        if (receivedTranscript && receivedTranscript.trim().length > 0) {
          if (data.is_final) {
            aggregatedTranscript.current += (aggregatedTranscript.current ? " " : "") + receivedTranscript;
            
            if (onReceivedRef.current) {
              onReceivedRef.current(aggregatedTranscript.current, false);
            }

            if (finalizeTimeout.current) clearTimeout(finalizeTimeout.current);
            
            finalizeTimeout.current = setTimeout(() => {
              const fullText = aggregatedTranscript.current.trim();
              if (fullText && onReceivedRef.current) {
                console.log("Finalizing speech segment:", fullText);
                onReceivedRef.current(fullText, true);
              }
              aggregatedTranscript.current = "";
            }, END_OF_SPEECH_WAIT_MS);

          } else {
            const previewText = (aggregatedTranscript.current + " " + receivedTranscript).trim();
            if (onReceivedRef.current) {
              onReceivedRef.current(previewText, false);
            }
          }
        }
      };

      socketRef.current.onerror = (error) => {
        console.error("Deepgram Error:", error);
        stopStreaming();
      };
      
      socketRef.current.onclose = () => stopStreaming();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      audioContextRef.current = new AudioContextClass({ sampleRate: 16000 });

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(2048, 1, 1);
      
      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      processor.onaudioprocess = (e) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
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
