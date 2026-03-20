"use client"

import { useState, useEffect, useRef } from 'react'
import { MessageTurn, CopilotOutput, CustomerContext } from '@/lib/types'
import { STTProvider } from '@/lib/voice/stt/types'
import { useSTTPipeline } from '@/hooks/useSTTPipeline'

// --- Types ---
interface AuditTrail {
  loadedCustomer: string;
  usedPolicies: string[];
  selectedMemories: string[];
  factualStatements: string;
  riskSignal: string;
  boundaryStatus: string;
  escalationReason: string;
  safeGuidance: string[];
  forbiddenPromises: string[];
}

export default function TelcoCopilotDashboard() {
  const [activeTab, setActiveTab] = useState<'live' | 'supervisor' | 'audit'>('live')
  const [showInspector, setShowInspector] = useState(false)
  const [scenarios, setScenarios] = useState<any[]>([])
  const [sttProvider, setSttProvider] = useState<STTProvider>('online')
  
  const [transcript, setTranscript] = useState<MessageTurn[]>([])
  const [analysis, setAnalysis] = useState<CopilotOutput | null>(null)
  const [customerContext, setCustomerContext] = useState<CustomerContext | null>(null)
  const [latestAudit, setLatestAudit] = useState<AuditTrail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState("")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [phoneNumber, setPhoneNumber] = useState("555-0101") 
  const [isIdentified, setIsIdentified] = useState(false)
  const [callEnded, setCallEnded] = useState(false)
  const [caseSummary, setCaseSummary] = useState<any | null>(null)
  const [supervisorSessions, setSupervisorSessions] = useState<any[]>([])
  const [supervisorFilter, setSupervisorFilter] = useState('all')
  const [offlineStatus, setOfflineStatus] = useState<string>("checking...")

  const [hasMounted, setHasMounted] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setHasMounted(true)
    fetchScenarios()

    // Restore provider from local storage
    const saved = localStorage.getItem('stt_provider') as STTProvider;
    if (saved) setSttProvider(saved);
    
    // Check Offline STT Health
    const checkOfflineHealth = async () => {
      try {
        const resp = await fetch('http://localhost:8000/stt/status');
        const data = await resp.json();
        setOfflineStatus(data.status === 'active' ? 'ENGINE READY' : 'IDLE / READY');
      } catch {
        setOfflineStatus('UNAVAILABLE');
      }
    };
    checkOfflineHealth();
    const interval = setInterval(checkOfflineHealth, 10000);
    return () => clearInterval(interval);
  }, [])

  useEffect(() => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 100);
  }, [transcript, interimTranscript])

  const fetchScenarios = async () => {
    try {
      const resp = await fetch('/api/simulation/scenarios')
      const data = await resp.json()
      setScenarios(data)
    } catch (err) { console.error(err); }
  }

  const fetchSupervisorData = async (filter: string) => {
    try {
      const resp = await fetch(`/api/supervisor/sessions?filter=${filter}`)
      const data = await resp.json()
      setSupervisorSessions(data)
    } catch (err) { console.error(err); }
  }

  const identifyCustomer = async (num = phoneNumber) => {
    setIsLoading(true);
    try {
      const resp = await fetch('/api/customer/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: num, channelType: 'voice' })
      });
      const data = await resp.json();
      if (resp.ok) {
        setSessionId(data.sessionId);
        setCustomerId(data.customer.id);
        setCustomerContext(data.customerContext);
        setIsIdentified(true);
        setTranscript([]);
        setAnalysis(null);
        setCaseSummary(null);
        setLatestAudit(null);
        setCallEnded(false);
      }
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  }

  const handleVoiceTranscript = async (text: string, isFinal: boolean, provider?: STTProvider) => {
    if (isFinal) {
      const customerTurn: MessageTurn = {
        turnId: Date.now(),
        speaker: 'customer',
        text: text,
        timestamp: new Date().toLocaleTimeString(),
        provider: provider || sttProvider
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
            customerId,
            customerContext,
            phoneNumber 
          })
        });

        const data = await resp.json();
        if (resp.ok) {
          setAnalysis(data.copilot);
          if (data.customerContext) setCustomerContext(data.customerContext);
          if (data.auditTrail) setLatestAudit(data.auditTrail);

          if (data.agent) {
            const agentTurn: MessageTurn = {
              turnId: Date.now() + 1,
              speaker: 'agent_ai',
              text: data.agent.reply,
              timestamp: new Date().toLocaleTimeString()
            };
            setTranscript(prev => [...prev, agentTurn]);
          }
        }
      } catch (err) { console.error(err); } finally { setIsLoading(false); }
    } else { setInterimTranscript(text); }
  };

  const { isRecording, startStreaming, stopStreaming, audioLevel } = useSTTPipeline({
    provider: sttProvider,
    onTranscriptReceived: handleVoiceTranscript
  });

  const endCall = async () => {
    setCallEnded(true);
    if (!sessionId || !customerId) return;
    const resp = await fetch('/api/session/end', {
      method: 'POST',
      body: JSON.stringify({ sessionId, customerId, latestInsight: analysis })
    });
    const data = await resp.json();
    if (data.caseSummary) setCaseSummary(data.caseSummary);
    stopStreaming();
  };

  const startDemo = (scenario: any) => {
     setActiveTab('live');
     identifyCustomer('555-0101');
  }

  if (!hasMounted) return <div className="loading-screen">INITIALIZING INTELLIGENCE COMMAND...</div>;

  return (
    <div className="dashboard-container">
      <nav className="app-tabs">
        <div className="nav-left">
          <div className="logo">TELCO COPILOT <span className="v-tag"> v2.0 PRO</span></div>
        </div>
        <div className="nav-center">
          <button className={`tab-btn ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>LIVE CALL HUB</button>
          <button className={`tab-btn ${activeTab === 'supervisor' ? 'active' : ''}`} onClick={() => { setActiveTab('supervisor'); fetchSupervisorData(supervisorFilter); }}>SUPERVISOR VIEW</button>
          <button className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>AUDIT LOGS</button>
        </div>
        <div className="nav-right" style={{display:'flex', gap:'1rem', alignItems:'center'}}>
          <div className={`sc-diff ${offlineStatus === 'UNAVAILABLE' ? 'Hard' : 'Easy'}`} style={{fontSize:'0.6rem'}}>
            OFFLINE ENGINE: {offlineStatus}
          </div>
          <button className={`inspector-toggle ${showInspector ? 'on' : ''}`} onClick={() => setShowInspector(!showInspector)}>
             INTEL INSPECTOR {showInspector ? 'ON' : 'OFF'}
          </button>
        </div>
      </nav>

      <header className="premium-header">
        <div className="header-actions">
          <div className="phone-input-group">
            <span className="group-label">ACTIVE LINE</span>
            <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="phone-input" />
          </div>
          <button className={`action-btn ${isIdentified ? 'success' : 'primary'}`} onClick={() => identifyCustomer()} disabled={isLoading}>
            {isIdentified ? 'LOADED' : 'IDENTIFY SESSION'}
          </button>

          <div className="stt-toggle">
            <button 
              className={`stt-toggle-btn ${sttProvider === 'online' ? 'active' : ''}`}
              onClick={() => { setSttProvider('online'); localStorage.setItem('stt_provider', 'online'); }}
              disabled={isRecording}
            >
              Online
            </button>
            <button 
              className={`stt-toggle-btn ${sttProvider === 'offline' ? 'active' : ''}`}
              onClick={() => { setSttProvider('offline'); localStorage.setItem('stt_provider', 'offline'); }}
              disabled={isRecording}
            >
              Offline
            </button>
          </div>

          <button className={`action-btn voice-btn ${isRecording ? 'recording' : ''}`} onClick={isRecording ? stopStreaming : startStreaming} disabled={!isIdentified || callEnded}>
            {isRecording ? "STOP LISTENING" : "START VOICE"}
          </button>
          <button className="action-btn end-btn" onClick={endCall} disabled={!isIdentified || callEnded}>END SESSION</button>
        </div>
        
        <div className="kpi-strip">
           <div className="kpi-item"><span className="group-label">CHURN</span><span className={`kpi-val ${customerContext?.customerSnapshot.churnRisk! > 70 ? 'danger' : ''}`}>{customerContext?.customerSnapshot.churnRisk?.toFixed(0) || 0}%</span></div>
           <div className="kpi-item"><span className="group-label">TREND</span><span className="kpi-val">{analysis?.sentiment || 'Neutral'}</span></div>
           <div className="kpi-item"><span className="group-label">POLICIES</span><span className="kpi-val">{latestAudit?.usedPolicies.length || 0}</span></div>
           <div className="kpi-item"><span className="group-label">MEMORIES</span><span className="kpi-val">{customerContext?.relevantMemories.length || 0}</span></div>
        </div>
      </header>

      <main className="dashboard-content">
        {activeTab === 'live' && (
          <div className="dashboard-grid">
            {/* Left: Grounding Context */}
            <section className="side-panel">
               <div className="card">
                  <div className="card-header">
                     <span className="card-title">FACTUAL GROUNDING</span>
                     <span className="sc-diff Easy">SQLITE REALTIME</span>
                  </div>
                  {customerContext ? (
                    <div className="ctx-content">
                       <h3 className="cust-name">{customerContext.customerSnapshot.name}</h3>
                       <p className="cust-meta">{customerContext.customerSnapshot.planType} • {customerContext.customerSnapshot.region}</p>
                       <div className="memory-timeline">
                          <span className="card-title" style={{marginBottom: '1rem'}}>CUSTOMER TIMELINE</span>
                          {customerContext.relevantMemories.map((m, i) => (
                             <div key={i} className="timeline-node">
                                <span className="node-dot"></span>
                                <div className="node-text">{m}</div>
                             </div>
                          ))}
                       </div>
                    </div>
                  ) : <div className="node-text" style={{marginTop: '1rem', opacity: 0.5}}>No customer context grounded.</div>}
               </div>

               <div className="card">
                  <div className="card-title" style={{marginBottom: '1rem'}}>DEMO SCENARIOS</div>
                  <div className="side-panel" style={{overflow:'visible'}}>
                     {scenarios.map(s => (
                        <div key={s.id} className="scenario-item" onClick={() => startDemo(s)}>
                           <div className="sc-header"><span className="sc-title">{s.title}</span><span className={`sc-diff ${s.difficulty}`}>{s.difficulty}</span></div>
                           <p className="sc-desc">{s.description}</p>
                        </div>
                     ))}
                  </div>
               </div>
            </section>

            {/* Middle: Live Analysis & Transcript */}
            <section className="main-feed">
               <div className="live-analysis-bar">
                  <div className="analytics-box">
                     <span className="box-label">FRUSTRATION DEPTH</span>
                     <div className="depth-meter">
                       <div className="depth-fill" style={{ 
                         width: `${analysis?.riskLevel === 'High' ? 100 : analysis?.riskLevel === 'Medium' ? 60 : 20}%`,
                         background: analysis?.riskLevel === 'High' ? 'var(--danger)' : analysis?.riskLevel === 'Medium' ? 'var(--warning)' : 'var(--success)'
                       }}></div>
                     </div>
                  </div>
                  <div className="analytics-box">
                     <span className="box-label">POLICY BOUNDARY</span>
                     <span className={`st ${analysis?.policyBoundaryStatus || 'completed'}`} style={{padding:0}}>{analysis?.policyBoundaryStatus || 'SAFE'}</span>
                  </div>
               </div>

               <div className="transcript-area" ref={scrollRef}>
                 {transcript.map((turn, idx) => (
                   <div key={turn.turnId} className={`msg-wrapper ${turn.speaker}`}>
                     <div className="msg-avatar">{turn.speaker === 'customer' ? '👤' : '🤖'}</div>
                     <div className="msg-content">
                       <div className="msg-bubble">
                          <div className="msg-header">
                             <div style={{display:'flex', alignItems:'center'}}>
                                <span className="msg-speaker">{turn.speaker === 'customer' ? 'CUSTOMER' : 'TELCO COPILOT'}</span>
                                {turn.provider && (
                                  <span className={`provider-badge ${turn.provider}`}>
                                    {turn.provider}
                                  </span>
                                )}
                             </div>
                             {turn.speaker === 'agent_ai' && idx === transcript.length - 1 && <span className="sc-diff Easy" style={{fontSize: '0.5rem', background: 'rgba(16,185,129,0.1)'}}>🛡️ AUDITED</span>}
                          </div>
                          <div className="msg-text">{turn.text}</div>
                       </div>
                       <div className="msg-time">{turn.timestamp}</div>
                     </div>
                   </div>
                 ))}
                 {interimTranscript && (
                   <div className="msg-wrapper customer" style={{opacity: 0.5}}>
                     <div className="msg-avatar">👤</div>
                     <div className="msg-bubble">{interimTranscript}</div>
                   </div>
                 )}
                 {isLoading && !interimTranscript && (
                   <div className="msg-wrapper agent_ai" style={{opacity: 0.5}}>
                     <div className="msg-avatar">🤖</div>
                     <div className="msg-bubble">...</div>
                   </div>
                 )}
               </div>

               {caseSummary && (
                 <div className="case-overlay">
                    <div className="card" style={{ maxWidth: '600px', border: '1px solid #d4af37', background: '#09090b', padding: '2rem' }}>
                       <h2 className="cust-name" style={{ color: '#d4af37', marginBottom: '1.5rem' }}>CASE SUMMARY REPORT</h2>
                       <div className="audit-details" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                          <div className="audit-block"><h5>PRIMARY INTENT</h5><p>{caseSummary.intelligenceProfile.intent}</p></div>
                          <div className="audit-block"><h5>FACTS EXTRACTED</h5><ul>{caseSummary.extractedFacts.slice(0, 3).map((f:any, i:number) => <li key={i}>{f}</li>)}</ul></div>
                          <div className="audit-block"><h5>POLICY AUDIT</h5><p>{caseSummary.policyAudit.reason}</p></div>
                          <div className="audit-block"><h5>NEXT ACTION</h5><p>{caseSummary.recommendations.nextAction}</p></div>
                       </div>
                       <div className="header-actions" style={{marginTop: '2rem', justifyContent: 'center'}}>
                          <button className="action-btn primary" onClick={() => navigator.clipboard.writeText(JSON.stringify(caseSummary))}>COPY CRM JSON</button>
                          <button className="action-btn end-btn" onClick={() => setCaseSummary(null)}>CLOSE</button>
                       </div>
                    </div>
                 </div>
               )}
            </section>

            {/* Right: Insights & Inspector */}
            <section className="side-panel">
               {showInspector ? (
                 <div className="card">
                    <div className="card-title" style={{marginBottom: '1rem'}}>INTEL INSPECTOR</div>
                    {latestAudit ? (
                      <div className="audit-details">
                         <div className="audit-block"><h5>USED POLICIES:</h5> <p>{latestAudit.usedPolicies.join(', ')}</p></div>
                         <div className="audit-block"><h5>SQL GROUNDING:</h5> <p>{latestAudit.factualStatements}</p></div>
                         <div className="audit-block"><h5>MEMORY INJECTED:</h5> <p>{latestAudit.selectedMemories.join('; ')}</p></div>
                         <div className="audit-block"><h5>FORBIDDEN:</h5> <p>{latestAudit.forbiddenPromises.join('; ')}</p></div>
                      </div>
                    ) : <div className="node-text">No turn payload to inspect.</div>}
                 </div>
               ) : (
                 <>
                  <div className="card">
                    <div className="card-title" style={{marginBottom: '1rem'}}>COPILOT INTELLIGENCE</div>
                    {analysis ? (
                       <div className="ins-body">
                          <div className="ins-row"><span>EMOTION</span><span className="v">{analysis.sentiment}</span></div>
                          <div className="ins-row"><span>CHURN RISK</span><span className="v">{analysis.riskLevel}</span></div>
                          <div className="explanation-bubble">
                             <strong>RATIONALE:</strong><br/>
                             {analysis.explanations?.intent}<br/>
                             {analysis.explanations?.escalation}
                          </div>
                       </div>
                    ) : <div className="node-text">Analysis engine idle.</div>}
                  </div>
                  <div className="card">
                    <div className="card-title" style={{marginBottom: '1rem'}}>NEXT BEST ACTIONS</div>
                    <div className="side-panel" style={{overflow:'visible'}}>
                      {analysis?.suggestions.map((s, i) => (
                        <div key={i} className="sug-card">
                            <span className="sug-type">{s.type}</span>
                            <p className="sug-text">{s.text}</p>
                        </div>
                      ))}
                      {!analysis && <div className="node-text">Listening for suggestions...</div>}
                    </div>
                  </div>
                 </>
               )}
            </section>
          </div>
        )}

        {activeTab === 'supervisor' && (
          <div className="supervisor-view">
             <div className="view-header">
                <h2>SUPERVISOR DASHBOARD</h2>
                <div className="filter-tabs">
                   <button onClick={() => { setSupervisorFilter('all'); fetchSupervisorData('all'); }} className={supervisorFilter === 'all' ? 'on' : ''}>ALL</button>
                   <button onClick={() => { setSupervisorFilter('escalated'); fetchSupervisorData('escalated'); }} className={supervisorFilter === 'escalated' ? 'on' : ''}>ESCALATED</button>
                   <button onClick={() => { setSupervisorFilter('risk'); fetchSupervisorData('risk'); }} className={supervisorFilter === 'risk' ? 'on' : ''}>HIGH RISK</button>
                </div>
             </div>
             <table className="session-table">
                <thead><tr><th>CUSTOMER</th><th>INTENT</th><th>SENTIMENT</th><th>POLICY</th><th>STATUS</th></tr></thead>
                <tbody>
                   {supervisorSessions.map(s => (
                      <tr key={s.id}>
                         <td>{s.customer?.name}</td>
                         <td>{s.summary?.overallIntent}</td>
                         <td>{s.summary?.finalSentiment}</td>
                         <td>{s.turns[0]?.insight?.policyBoundaryStatus}</td>
                         <td><span className={`st ${s.status}`}>{s.status}</span></td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="supervisor-view">
             <h2>POLICY COMPLIANCE LOGS</h2>
             <p className="node-text" style={{marginTop:'0.5rem', marginBottom:'2rem'}}>System-wide audit trail of all factual grounding and policy-enforcement events.</p>
             <div className="audit-details">
                <div className="card" style={{flexDirection: 'row', gap: '2rem', alignItems:'center'}}>
                   <span className="group-label">10:45:01</span>
                   <span className="sc-diff Easy" style={{width: '120px', textAlign:'center'}}>Pacific_992</span>
                   <p className="node-text">Applied BILL-001 ($25 Refund Limit). Request for $200 was blocked. Escalation triggered.</p>
                </div>
             </div>
          </div>
        )}
      </main>
    </div>
  )
}
