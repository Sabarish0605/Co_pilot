import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Key, ShieldCheck, Zap, Bot, Loader2, Volume2, MoveHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDeepgramStream } from './hooks/useDeepgramStream';

function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('deepgram_key') || "");
  const [showKey, setShowKey] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Handle AI Response and Voice
  const handleFinalTranscript = useCallback(async (text) => {
    if (!text.trim()) return;
    
    setIsProcessing(true);
    try {
      // 1. Get AI Response from OpenRouter
      const chatRes = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      
      if (!chatRes.ok) throw new Error('AI Chat failed');
      const chatData = await chatRes.json();
      const responseText = chatData.text;
      
      setAiResponse(responseText);

      // 2. Trigger Speak on Backend (pyttsx3)
      await fetch('http://localhost:8000/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: responseText }),
      });

    } catch (err) {
      console.error("AI Assistant Error:", err);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const { 
    isRecording, 
    transcript, 
    audioLevel, 
    startStreaming, 
    stopStreaming,
    clearTranscript 
  } = useDeepgramStream(apiKey, handleFinalTranscript);

  const handleKeyChange = (e) => {
    const val = e.target.value;
    setApiKey(val);
    localStorage.setItem('deepgram_key', val);
  };

  const bars = Array.from({ length: 30 }, (_, i) => i);

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center p-8 bg-black">
      
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 blur-[120px] rounded-full" />
      </div>

      {/* Top Header - Minimal */}
      <div className="fixed top-0 left-0 right-0 p-8 flex justify-between items-center z-50">
        <div className="flex items-center gap-3">
          <Bot className="w-6 h-6 text-indigo-400" />
          <span className="text-sm font-bold tracking-[0.3em] uppercase text-zinc-500">EduFlash AI</span>
        </div>
        
        <div className="flex items-center gap-3 glass px-4 py-2 border-zinc-800">
          <Key className="w-3.5 h-3.5 text-zinc-500" />
          <input
            type={showKey ? "text" : "password"}
            placeholder="Deepgram Key"
            value={apiKey}
            onChange={handleKeyChange}
            className="bg-transparent border-none outline-none text-xs w-28 text-zinc-400"
          />
          <button onClick={() => setShowKey(!showKey)}>
            <ShieldCheck className={`w-3.5 h-3.5 ${apiKey ? 'text-indigo-400' : 'text-zinc-700'}`} />
          </button>
        </div>
      </div>

      {/* NEW SPACIOUS LAYOUT */}
      <div className="max-w-4xl w-full flex flex-col items-center gap-12 z-10">
        
        {/* 1. Title Section */}
        <div className="text-center space-y-2">
            <h1 className="text-sm font-black uppercase tracking-[0.5em] text-indigo-500 opacity-80">
                Voice Assistant Mode
            </h1>
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">
                Mistral-AI Powered • Real-time
            </p>
        </div>

        {/* 2. Audio Visualizer (Google Assistant Style) */}
        <div className="flex items-center gap-2 h-16">
          {bars.map((i) => (
            <motion.div
              key={i}
              className="w-1 rounded-full"
              style={{ backgroundColor: isRecording ? '#6366f1' : '#27272a' }}
              animate={{ 
                height: isRecording ? Math.max(8, audioLevel * 150 * (0.3 + Math.random())) : 4,
                opacity: isRecording ? 1 : 0.3
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            />
          ))}
        </div>

        {/* 3. AI Response Box (FOCAL ELEMENT) */}
        <div className="w-full min-h-[160px] flex items-center justify-center px-4">
          <AnimatePresence mode="wait">
            {aiResponse ? (
              <motion.p
                key={aiResponse}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-4xl md:text-5xl font-extrabold text-white text-center leading-tight tracking-tight drop-shadow-2xl"
              >
                {aiResponse}
              </motion.p>
            ) : isProcessing ? (
                <div className="flex flex-col items-center gap-4 text-indigo-400/50">
                    <Loader2 className="w-10 h-10 animate-spin" />
                    <span className="text-[10px] uppercase font-bold tracking-[0.3em]">AI is thinking...</span>
                </div>
            ) : (
              <p className="text-zinc-700 text-3xl font-bold italic opacity-40">Waiting for your command...</p>
            )}
          </AnimatePresence>
        </div>

        {/* 4. User Speech Card (Clean & Dark) */}
        <AnimatePresence>
            {(transcript || isRecording) && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="user-card w-full flex flex-col items-center gap-4"
              >
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 opacity-50 mb-2">
                    <Mic className="w-3 h-3" />
                    <span>Live Transcription</span>
                </div>
                <p className="text-xl md:text-2xl font-bold text-zinc-300 text-center leading-relaxed">
                  {transcript || "Speak clearly..."}
                </p>
              </motion.div>
            )}
        </AnimatePresence>

        {/* 5. Main Action Button */}
        <div className="flex flex-col items-center gap-6 pt-8">
            <button
                onClick={isRecording ? stopStreaming : startStreaming}
                className={`group flex items-center justify-center gap-4 px-12 py-6 rounded-full font-black text-2xl transition-all duration-500 ${
                isRecording 
                    ? 'bg-red-500 shadow-[0_0_50px_rgba(239,68,68,0.3)] text-white scale-110' 
                    : 'bg-white text-black hover:bg-zinc-200 shadow-[0_0_50px_rgba(255,255,255,0.1)] hover:-translate-y-2'
                }`}
            >
                {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                <span>{isRecording ? "Listening" : "Start Assistant"}</span>
            </button>
            
            <div className="flex items-center gap-8">
                <button
                    onClick={async () => { 
                      clearTranscript(); 
                      setAiResponse(""); 
                      try {
                        await fetch('http://localhost:8000/reset', { method: 'POST' });
                      } catch (err) {
                        console.error('Failed to reset conversation history:', err);
                      }
                    }}
                    className="text-zinc-600 hover:text-white transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                >
                    <Zap className="w-4 h-4" />
                    Reset
                </button>
                <div className="w-px h-4 bg-zinc-800" />
                <div className="flex items-center gap-2 text-zinc-600 text-xs font-bold uppercase tracking-widest">
                    <Volume2 className="w-4 h-4" />
                    Offline TTS
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}

export default App;
