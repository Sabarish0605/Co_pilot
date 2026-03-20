export type MessageTurn = {
  turnId: number
  speaker: "customer" | "agent_ai"
  text: string
  timestamp: string
}

export type CopilotOutput = {
  intent: string
  sentiment: "Neutral" | "Mildly Frustrated" | "Frustrated" | "Angry"
  riskLevel: "Low" | "Medium" | "High"
  riskTags: string[]
  memoryFacts: string[]
  suggestions: {
    rank: number
    type: "Empathy" | "Resolution" | "Clarification" | "Retention" | "Escalation"
    text: string
    confidence: number
  }[]
  escalation: {
    needed: boolean
    reason?: string
  }
  // Explainability enrichment
  explanations?: {
    intent?: string
    sentiment?: string
    risk?: string
    escalation?: string
    nextBestAction?: string
  }
}

export interface CustomerProfile {
  id: string
  name: string
  phoneNumber: string
  planType: string
  region: string
  preferredLanguage: string
  totalComplaints: number
  lastComplaintCategory?: string
  churnRisk: number
  retentionEligible: boolean
  vipStatus: boolean
  lastSentiment: string
}

export interface CustomerContext {
  customerSnapshot: Partial<CustomerProfile>
  supportHistory: {
    billingIssues: number
    networkIssues: number
    escalations: number
  }
  relevantMemories: string[]
  personalizationHints: string[]
  retentionSignals: string[]
  recommendedTone: "neutral" | "empathetic" | "assertive" | "premium"
}
