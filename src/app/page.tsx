"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageTurn, CopilotOutput } from '@/lib/types'
import { useDeepgramStream } from '@/hooks/useDeepgramStream'

// Simulation defaults
const MOCK_TRANSCRIPT_INPUTS: { speaker: "customer" | "agent_ai"; text: string }[] = [
  { speaker: "customer", text: "Hi, I am looking at my bill and I was charged twice this month for the data plan." },
  { speaker: "agent_ai", text: "I'm sorry to hear that. Let me look up your account details. Can you confirm your phone number?" },
  { speaker: "customer", text: "It is 555-0199. I already called yesterday and the representative said it would be fixed, but nothing happened." },
  { speaker: "agent_ai", text: "Thank you. I see the record of your call. It looks like the refund is still pending approval." },
  { speaker: "customer", text: "This is very frustrating. I've been with you for 5 years and I'm honestly ready to switch to another provider if this is how you treat customers." },
  { speaker: "agent_ai", text: "I completely understand your frustration. We value your loyalty. Let me see what I can do to expedite this." },
  { speaker: "customer", text: "I've heard that before. I WANT TO SPEAK TO A MANAGER RIGHT NOW. THIS IS UNACCEPTABLE." },
  { speaker: "agent_ai", text: "I understand. I am initiating a transfer to my supervisor immediately." }
]

const MOCK_AGENT_REPLIES = [
  "I understand. Let me look into that for you.",
  "I see progress on your ticket, but it's taking longer than expected. I apologize.",
  "That sounds concerning. I'm prioritizing this right now.",
  "I have noted your concern. A supervisor will be able to help further."
];

export default function CopilotDashboard() {
  const [transcript, setTranscript] = useState<MessageTurn[]>([])
  const [currentManualIndex, setCurrentManualIndex] = useState(0)
  const [analysis, setAnalysis] = useState<CopilotOutput | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [transcript, interimTranscript])

  const runAnalysis = async (history: MessageTurn[], latest: MessageTurn) => {
    setIsLoading(true)
    try {
      const resp = await fetch('/api/copilot/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcriptHistory: history, latestMessage: latest })
      })
      const data = await resp.json()
      setAnalysis(data)
    } catch (err) {
      console.error("Analysis error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const addTurn = useCallback(async (speaker: "customer" | "agent_ai", text: string) => {
    setTranscript((prev) => {
      const turnId = prev.length + 1;
      const turn: MessageTurn = {
        turnId,
        speaker,
        text,
        timestamp: new Date().toLocaleTimeString()
      };
      
      const newHistory = [...prev, turn];
      runAnalysis(prev, turn);
      return newHistory;
    });
  }, []);

  const handleVoiceTranscript = (text: string, isFinal: boolean) => {
    if (isFinal) {
      setInterimTranscript("");
      addTurn("customer", text);
      
      setTimeout(() => {
        const reply = MOCK_AGENT_REPLIES[Math.floor(Math.random() * MOCK_AGENT_REPLIES.length)];
        addTurn("agent_ai", reply);
      }, 1200);
    } else {
      setInterimTranscript(text);
    }
  };

  const { isRecording, startStreaming, stopStreaming, audioLevel } = useDeepgramStream({
    onTranscriptReceived: handleVoiceTranscript
  });

  const handleManualNextTurn = async () => {
    if (currentManualIndex >= MOCK_TRANSCRIPT_INPUTS.length) return
    const next = MOCK_TRANSCRIPT_INPUTS[currentManualIndex];
    addTurn(next.speaker, next.text);
    setCurrentManualIndex(prev => prev + 1);
  };

  const handleReset = () => {
    setTranscript([])
    setCurrentManualIndex(0)
    setAnalysis(null)
    setInterimTranscript("")
  }

  return (
    <div className="dashboard-container">
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="logo">TELCO COPILOT AI</div>
          <div style={{ fontSize: '0.8rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 'bold' }}>
            SECURE VOICE ACTIVE
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={handleReset} style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>Reset</button>
          
          <button 
            onClick={isRecording ? stopStreaming : startStreaming}
            style={{ 
              background: isRecording ? 'var(--danger)' : 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              minWidth: '200px'
            }}
          >
            {isRecording ? "Stop Voice Mode" : "Start Voice Mode"}
            {isRecording && (
              <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '12px' }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{ width: '3px', background: 'white', height: `${Math.max(2, audioLevel * 100 * (i/2))}px` }} />
                ))}
              </div>
            )}
          </button>

          <button onClick={handleManualNextTurn} disabled={currentManualIndex >= MOCK_TRANSCRIPT_INPUTS.length || isLoading}>
            {isLoading ? "Analyzing..." : "Simulation Turn"}
          </button>
        </div>
      </header>

      <main className="main-content">
        <div className="transcript-panel" ref={scrollRef}>
          <div className="card-title">Live Conversation Transcript</div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: '1rem' }}>
            {transcript.length === 0 && !interimTranscript && (
              <div style={{ textAlign: 'center', color: '#71717a', marginTop: '4rem' }}>
                Start voice mode or simulation to begin analysis.
              </div>
            )}
            {transcript.map((msg) => (
              <div key={msg.turnId} className={`message ${msg.speaker === 'customer' ? 'customer' : 'agent'}`}>
                <div className="message-bubble">{msg.text}</div>
                <div className="message-meta">{msg.speaker === 'customer' ? 'Customer' : 'AI Agent'} • {msg.timestamp}</div>
              </div>
            ))}
            {interimTranscript && (
              <div className="message customer" style={{ opacity: 0.6 }}>
                <div className="message-bubble" style={{ borderStyle: 'dashed' }}>{interimTranscript}...</div>
                <div className="message-meta">Customer speaking...</div>
              </div>
            )}
          </div>
        </div>
      </main>

      <aside className="copilot-sidebar">
        <div className="card">
          <div className="card-title">Analysis Summary</div>
          {analysis ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.2rem' }}>SENTIMENT</div>
                <div className="sentiment-label" style={{ 
                  color: analysis.sentiment === 'Angry' ? 'var(--danger)' : 
                         analysis.sentiment === 'Frustrated' ? 'var(--warning)' : 
                         analysis.sentiment === 'Mildly Frustrated' ? '#fde047' : 'var(--success)'
                }}>
                  {analysis.sentiment}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>INTENT</div>
                  <div style={{ fontWeight: '600' }}>{analysis.intent}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>RISK</div>
                  <span className={`badge ${analysis.riskLevel.toLowerCase()}`}>{analysis.riskLevel}</span>
                </div>
              </div>
              {analysis.riskTags.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>RISK TAGS</div>
                  <div>
                    {analysis.riskTags.map(tag => <span key={tag} className="pill" style={{ background: 'rgba(99, 102, 241, 0.1)', borderColor: 'var(--primary)', color: 'white' }}>{tag}</span>)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#71717a', fontSize: '0.875rem' }}>Waiting for speech or interaction...</div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Next Best Action</div>
          {analysis ? (
            <div>
              {analysis.suggestions.map((s) => (
                <div key={s.rank} className="suggestion-item">
                  <div className="suggestion-type">{s.type}</div>
                  <div style={{ fontSize: '0.875rem' }}>{s.text}</div>
                  <div style={{ fontSize: '0.7rem', color: '#71717a', marginTop: '0.4rem', textAlign: 'right' }}>
                    Confidence: {(s.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#71717a', fontSize: '0.875rem' }}>Suggestions will appear here.</div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Facts Extracted</div>
          {analysis && analysis.memoryFacts.length > 0 ? (
            <ul style={{ paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
              {analysis.memoryFacts.map((fact, i) => (
                <li key={i} style={{ marginBottom: '0.5rem', color: '#d4d4d8' }}>{fact}</li>
              ))}
            </ul>
          ) : (
            <div style={{ color: '#71717a', fontSize: '0.875rem' }}>No facts detected yet.</div>
          )}
        </div>

        {analysis?.escalation.needed && (
          <div className="escalation-alert">
            <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>⚠️ ESCALATION RECOMMENDED</div>
            <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>{analysis.escalation.reason}</div>
          </div>
        )}
      </aside>
    </div>
  )
}
