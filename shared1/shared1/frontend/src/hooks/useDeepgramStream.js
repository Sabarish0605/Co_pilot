import { useState, useRef, useCallback, useEffect } from 'react';

export const useDeepgramStream = (apiKey, onFinalTranscript) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  
  const socketRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);

  const startStreaming = async () => {
    if (!apiKey) {
      alert("Please provide a Deepgram API Key");
      return;
    }

    try {
      // 1. Initialize WebSocket
      const url = "wss://api.deepgram.com/v1/listen?model=nova-3&encoding=linear16&sample_rate=16000&channels=1&interim_results=true&smart_format=true";
      socketRef.current = new WebSocket(url, ["token", apiKey]);
      
      socketRef.current.onopen = () => {
        console.log("Deepgram connected");
        setConnectionStatus("connected");
        setIsRecording(true);
      };

      socketRef.current.onmessage = (message) => {
        const data = JSON.parse(message.data);
        const receivedTranscript = data.channel?.alternatives[0]?.transcript;
        
        if (receivedTranscript && data.is_final) {
          setTranscript((prev) => prev + " " + receivedTranscript);
          if (onFinalTranscript) onFinalTranscript(receivedTranscript);
        } else if (receivedTranscript) {
          // For interim results, we can handle them separately if wanted,
          // but for simple "typing" effect, we can show them in a separate state.
          // For now, we'll just handle the final ones to keep the UI clean.
        }
      };

      socketRef.current.onerror = (error) => console.error("Deepgram Error:", error);
      socketRef.current.onclose = () => {
        console.log("Deepgram connection closed");
        setConnectionStatus("disconnected");
        setIsRecording(false);
      };

      // 2. Initialize Audio
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000,
      });

      const source = audioContextRef.current.createMediaStreamSource(stream);
      // Small buffer for low latency
      const processor = audioContextRef.current.createScriptProcessor(2048, 1, 1);
      
      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      processor.onaudioprocess = (e) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          
          // Audio level for visualizer
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          setAudioLevel(Math.sqrt(sum / inputData.length));
          
          // Convert to Int16 PCM
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
      setIsRecording(false);
    }
  };

  const stopStreaming = useCallback(() => {
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
  }, []);

  return {
    isRecording,
    transcript,
    audioLevel,
    connectionStatus,
    startStreaming,
    stopStreaming,
    clearTranscript: () => setTranscript("")
  };
};
