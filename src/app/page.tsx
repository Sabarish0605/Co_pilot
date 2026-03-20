"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageTurn, CopilotOutput, CustomerContext } from '@/lib/types'
import { useDeepgramStream } from '@/hooks/useDeepgramStream'

// Simulation defaults
const MOCK_TRANSCRIPT_INPUTS = [
  { speaker: "customer", text: "Hi, I'm calling about a duplicate recharge on my Prepaid account. I was charged $50 twice." },
  { speaker: "agent_ai", text: "I'm sorry for that billing mismatch. Let me check your account details." },
  { speaker: "customer", text: "I've been with Telco for 8 years and this is the third time this month there's been a data pack issue." },
  { speaker: "agent_ai", text: "I understand your frustration. Given your loyalty, I'm prioritizing this right now." },
  { speaker: "customer", text: "I want to port-out to a different provider if this isn't resolved today. I'm tired of these plan renewal failures." }
]

export default function TelcoCopilotDashboard() {
  const [transcript, setTranscript] = useState<MessageTurn[]>([])
  const [currentManualIndex, setCurrentManualIndex] = useState(0)
  const [analysis, setAnalysis] = useState<CopilotOutput | null>(null)
  const [customerContext, setCustomerContext] = useState<CustomerContext | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState("")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [phoneNumber, setPhoneNumber] = useState("555-0199") 
  const [callEnded, setCallEnded] = useState(false)
  
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [transcript, interimTranscript])

  // Initialize Session
  useEffect(() => {
    const startSession = async () => {
      const resp = await fetch('/api/sessions/start', { 
        method: 'POST', 
        body: JSON.stringify({ phoneNumber, channelType: 'simulation' }) 
      });
      const data = await resp.json();
      setSessionId(data.sessionId);
      setCustomerId(data.customerId);
    };
    startSession();
  }, [phoneNumber]);

  const handleVoiceTranscript = async (text: string, isFinal: boolean) => {
    if (isFinal) {
      setInterimTranscript("");
      const customerTurn: MessageTurn = {
        turnId: Date.now(),
        speaker: 'customer',
        text,
        timestamp: new Date().toLocaleTimeString()
      };
      
      setTranscript(prev => [...prev, customerTurn]);
      setIsLoading(true);

      try {
        const resp = await fetch('/api/chat/turn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            transcriptHistory: transcript, 
            latestMessage: customerTurn, 
            sessionId,
            phoneNumber 
          })
        });

        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Failed turn");
        
        setAnalysis(data.copilot);
        setCustomerContext(data.customerContext);

        if (data.agent) {
          const agentTurn: MessageTurn = {
            turnId: Date.now() + 1,
            speaker: 'agent_ai',
            text: data.agent.reply,
            timestamp: new Date().toLocaleTimeString()
          };
          setTranscript(prev => [...prev, agentTurn]);
        }

      } catch (err) {
        console.error("error:", err);
      } finally {
        setIsLoading(false);
      }
    } else {
      setInterimTranscript(text);
    }
  };

  const { isRecording, startStreaming, stopStreaming, audioLevel } = useDeepgramStream({
    onTranscriptReceived: handleVoiceTranscript
  });

  const handleManualNextTurn = async () => {
    if (currentManualIndex >= MOCK_TRANSCRIPT_INPUTS.length || callEnded) return
    const next = MOCK_TRANSCRIPT_INPUTS[currentManualIndex];
    
    setIsLoading(true);
    const customerTurn: MessageTurn = {
      turnId: Date.now(),
      speaker: next.speaker as "customer" | "agent_ai",
      text: next.text,
      timestamp: new Date().toLocaleTimeString()
    };

    const resp = await fetch('/api/chat/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        transcriptHistory: transcript, 
        latestMessage: customerTurn, 
        sessionId,
        phoneNumber 
      })
    });
    const data = await resp.json();
    setAnalysis(data.copilot);
    setCustomerContext(data.customerContext);
    setTranscript(prev => [...prev, customerTurn]);
    setCurrentManualIndex(prev => prev + 1);
    setIsLoading(false);
  };

  const endCall = async () => {
    setCallEnded(true);
    if (!sessionId || !customerId) return;
    await fetch('/api/sessions/end', {
      method: 'POST',
      body: JSON.stringify({ sessionId, customerId, latestInsight: analysis })
    });
  };

  return (
    <div className="dashboard-container">
      <header className="premium-header">
        <div className="header-left">
          <div className="logo">TELCO COPILOT AI</div>
          <div className="status-badge">SECURE VOICE ACTIVE</div>
        </div>
        <div className="header-actions">
          <div className="phone-input-group">
            <span style={{ fontSize: '0.7rem', color: '#a1a1aa' }}>ACTIVE LINE</span>
            <input 
              value={phoneNumber} 
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="phone-input"
            />
          </div>
          <button 
            onClick={isRecording ? stopStreaming : startStreaming}
            className={`voice-btn ${isRecording ? 'active' : ''}`}
          >
            {isRecording ? "Stop Listen" : "Start Listen"}
          </button>
          <button onClick={handleManualNextTurn} disabled={isLoading || callEnded} className="simulation-btn">
            {isLoading ? "Analyzing..." : "Simulation Turn"}
          </button>
          <button onClick={endCall} className="end-call-btn" disabled={callEnded}>End Call</button>
        </div>
      </header>

      <main className="dashboard-grid">
        {/* Left Column: Customer Snapshot */}
        <section className="dashboard-column customer-column">
          <div className="card customer-card">
            <div className="card-header">
              <span className="card-title">CUSTOMER SNAPSHOT</span>
              {customerContext?.customerSnapshot.vipStatus && <span className="vip-badge">VIP</span>}
            </div>
            {customerContext ? (
              <div className="customer-details">
                <div className="detail-row">
                  <span className="label">NAME</span>
                  <span className="value">{customerContext.customerSnapshot.name}</span>
                </div>
                <div className="detail-row">
                  <span className="label">PLAN</span>
                  <span className="value">{customerContext.customerSnapshot.planType}</span>
                </div>
                <div className="detail-row">
                  <span className="label">REGION</span>
                  <span className="value">{customerContext.customerSnapshot.region}</span>
                </div>
                <hr className="divider" />
                <div className="stats-grid">
                  <div className="stat-box">
                    <span className="label">CHURN RISK</span>
                    <span className="value risk-high">{(customerContext.customerSnapshot.churnRisk || 0 * 100).toFixed(0)}%</span>
                  </div>
                  <div className="stat-box">
                    <span className="label">BILLING ISSUES</span>
                    <span className="value">{customerContext.supportHistory.billingIssues}</span>
                  </div>
                </div>
                <div className="context-hints">
                  {customerContext.personalizationHints.map((hint, i) => (
                    <div key={i} className="hint-pill">{hint}</div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state">No customer data loaded.</div>
            )}
          </div>

          <div className="card">
            <div className="card-title">TELCO MEMORY</div>
            <div className="empty-state">Identifying relevant history...</div>
          </div>
        </section>

        {/* Center Column: Transcript */}
        <section className="dashboard-column transcript-column">
          <div className="card transcript-card" ref={scrollRef}>
            <div className="card-header">
              <span className="card-title">LIVE TRANSCRIPTION</span>
              <span className="typing-indicator">DEEPGRAM NOVA-2 ACTIVE</span>
            </div>
            <div className="transcript-flow">
              {transcript.map((msg) => (
                <div key={msg.turnId} className={`msg-group ${msg.speaker}`}>
                  <div className="msg-bubble">{msg.text}</div>
                  <div className="msg-meta">{msg.speaker === 'customer' ? 'Customer' : 'AI Agent'} • {msg.timestamp}</div>
                </div>
              ))}
              {interimTranscript && (
                <div className="msg-group customer interim">
                  <div className="msg-bubble">{interimTranscript}...</div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right Column: Copilot Insights */}
        <section className="dashboard-column insights-column">
          <div className="card insights-card">
            <div className="card-title">REAL-TIME COPILOT</div>
            {analysis ? (
              <div className="insights-content">
                <div className="insight-section">
                  <div className="insight-label">SENTIMENT</div>
                  <div className={`sentiment-val ${analysis.sentiment.toLowerCase()}`}>{analysis.sentiment}</div>
                  <p className="explain-text">{analysis.explanations?.sentiment}</p>
                </div>
                
                <div className="insight-section grid-2">
                  <div>
                    <div className="insight-label">INTENT</div>
                    <div className="value-bold">{analysis.intent}</div>
                  </div>
                  <div>
                    <div className="insight-label">CHURN WATCH</div>
                    <span className={`badge ${analysis.riskLevel.toLowerCase()}`}>{analysis.riskLevel}</span>
                  </div>
                </div>

                <div className="insight-section">
                  <div className="insight-label">NEXT BEST ACTION</div>
                  {analysis.suggestions.map((s, i) => (
                    <div key={i} className="suggestion-box">
                      <div className="sugg-type">{s.type}</div>
                      <div className="sugg-text">{s.text}</div>
                    </div>
                  ))}
                  <p className="explain-text">{analysis.explanations?.nextBestAction}</p>
                </div>
              </div>
            ) : (
              <div className="empty-state">Waiting for voice input...</div>
            )}
          </div>

          {analysis?.escalation.needed && (
            <div className="escalation-alert">
              <div className="alert-title">⚠️ ESCALATION RECOMMENDED</div>
              <div className="alert-reason">{analysis.escalation.reason}</div>
            </div>
          )}
        </section>
      </main>

      {/* End of Call Summary Modal */}
      {callEnded && (
        <div className="summary-overlay">
          <div className="summary-modal">
            <h2>CALL RESOLUTION SUMMARY</h2>
            <div className="summary-grid">
              <div>
                <h4>Final Sentiment</h4>
                <p>{analysis?.sentiment || "Neutral"}</p>
              </div>
              <div>
                <h4>Core Intent</h4>
                <p>{analysis?.intent || "General Query"}</p>
              </div>
            </div>
            <div className="summary-notes">
              <h4>Follow-up Actions</h4>
              <p>Customer reported {analysis?.intent}. Recommend technical follow-up within 24 hours.</p>
            </div>
            <button onClick={() => window.location.reload()} className="close-summary">New Session</button>
          </div>
        </div>
      )}
    </div>
  )
}
