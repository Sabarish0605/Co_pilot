import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, MessageSquare, Key, ShieldCheck, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDeepgramStream } from './hooks/useDeepgramStream';

function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('deepgram_key') || "");
  const [showKey, setShowKey] = useState(false);

  const {
    isRecording,
    transcript,
    audioLevel,
    connectionStatus,
    startStreaming,
    stopStreaming,
    clearTranscript
  } = useDeepgramStream(apiKey);

  const scrollRef = useRef(null);

  // Auto-scroll to bottom of transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  // Save API key
  const handleKeyChange = (e) => {
    const val = e.target.value;
    setApiKey(val);
    localStorage.setItem('deepgram_key', val);
  };

  const bars = Array.from({ length: 20 }, (_, i) => i);

  return (
    <div className="max-w-5xl w-full p-6 flex flex-col items-center min-h-screen">
      {/* Header */}
      <div className="w-full flex justify-between items-center mb-12">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Deepgram Real-Time</h1>
            <p className="text-zinc-500 text-sm font-medium uppercase tracking-widest">Nova-3 • Streaming Engine</p>
          </div>
        </div>

        {/* API Key Input */}
        <div className="relative group">
          <div className="flex items-center gap-2 glass px-4 py-2 rounded-xl border-indigo-500/20">
            <Key className="w-4 h-4 text-zinc-500" />
            <input
              type={showKey ? "text" : "password"}
              placeholder="Deepgram API Key"
              value={apiKey}
              onChange={handleKeyChange}
              className="bg-transparent border-none outline-none text-sm w-40 text-zinc-300 placeholder:text-zinc-600"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="text-zinc-600 hover:text-zinc-400"
            >
              <ShieldCheck className={`w-4 h-4 ${apiKey ? 'text-emerald-500' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Interface */}
      <div className="w-full grid grid-cols-1 gap-8 items-center justify-center max-w-4xl">

        {/* Transcription Area (Large & Centered) */}
        <div className="glass w-full min-h-[400px] flex flex-col p-8 relative overflow-hidden">
          <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/50 border border-zinc-800 backdrop-blur-sm z-10">
            <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-zinc-700'}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              {isRecording ? "Live Stream Active" : "Stream Idle"}
            </span>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto pr-4 scroll-smooth flex flex-col items-center justify-center text-center"
          >
            {transcript ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight text-white selection:bg-indigo-500 selection:text-white"
              >
                {transcript}
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="inline-block w-2 h-12 md:h-16 lg:h-20 bg-indigo-500 ml-2 mb-[-8px]"
                />
              </motion.div>
            ) : (
              <div className="flex flex-col items-center gap-4 text-zinc-600">
                <MessageSquare className="w-12 h-12 opacity-20" />
                <p className="text-2xl font-medium">Capture your thoughts in real-time...</p>
                <p className="text-sm opacity-50 uppercase tracking-widest italic">Wait for stream or start speaking</p>
              </div>
            )}
          </div>
        </div>

        {/* Control Bar (Lower 1/3) */}
        <div className="flex flex-col items-center gap-6">
          {/* Visualizer */}
          <div className="flex items-center gap-[6px] h-12 px-8 glass rounded-full">
            {bars.map((i) => (
              <motion.div
                key={i}
                className="w-1 bg-indigo-500/40 rounded-full"
                animate={{
                  height: isRecording ? Math.max(4, audioLevel * 100 * (0.5 + Math.random())) : 4,
                  backgroundColor: isRecording ? "#6366f1" : "rgba(99, 102, 241, 0.2)"
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              />
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={isRecording ? stopStreaming : startStreaming}
              className={`group flex items-center justify-center gap-3 px-12 py-5 rounded-full font-bold text-xl transition-all ${isRecording
                  ? 'bg-red-500 shadow-xl shadow-red-500/20 text-white'
                  : 'bg-indigo-600 shadow-xl shadow-indigo-500/20 text-white hover:bg-indigo-500 hover:-translate-y-1'
                }`}
            >
              {isRecording ? (
                <>
                  <MicOff className="w-7 h-7" />
                  <span>Stop Stream</span>
                </>
              ) : (
                <>
                  <Mic className="w-7 h-7 group-hover:scale-110 transition-transform" />
                  <span>Start Conversation</span>
                </>
              )}
            </button>
            <button
              onClick={clearTranscript}
              className="p-5 rounded-full glass hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-white"
              title="Clear Transcript"
            >
              <MessageSquare className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
