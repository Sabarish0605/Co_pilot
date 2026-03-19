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
}
