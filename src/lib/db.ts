import { prisma } from './prisma'
import { MessageTurn, CopilotOutput } from './types'

// --- Customer Helpers ---
export async function createCustomerIfNotExists(data: {
  phoneNumber: string
  name: string
  planType: string
  region: string
}) {
  return prisma.customer.upsert({
    where: { phoneNumber: data.phoneNumber },
    update: {},
    create: data,
  })
}

// --- Session Helpers ---
export async function createSession(data: {
  customerId?: string
  channelType: 'voice' | 'simulation'
}) {
  return prisma.session.create({
    data: {
      customerId: data.customerId,
      channelType: data.channelType,
      status: 'active',
    },
  })
}

export async function closeSession(sessionId: string, status: 'completed' | 'escalated' = 'completed') {
  return prisma.session.update({
    where: { id: sessionId },
    data: { 
      status,
      endedAt: new Date()
    },
  })
}

// --- Conversation Helpers ---
export async function saveConversationTurn(data: {
  sessionId: string
  turnIndex: number
  customerText: string
  agentReply: string
  sourceType: 'live' | 'simulated'
}) {
  return prisma.conversationTurn.create({
    data,
  })
}

export async function saveCopilotInsight(turnId: string, insight: CopilotOutput) {
  return prisma.copilotInsight.create({
    data: {
      turnId,
      intent: insight.intent,
      sentiment: insight.sentiment,
      riskLevel: insight.riskLevel,
      nextBestAction: insight.suggestions[0]?.text || 'No suggestion provided',
      escalationRecommended: insight.escalation.needed,
      escalationReason: insight.escalation.reason,
      confidenceScore: insight.suggestions[0]?.confidence || 1.0,
    },
  })
}

// --- Fact & Memory Helpers ---
export async function saveExtractedFacts(sessionId: string, turnId: string, facts: string[]) {
  const operations = facts.map(fact => 
    prisma.extractedFact.create({
      data: {
        sessionId,
        turnId,
        factKey: 'extracted_fact', // Simplify for hackathon
        factValue: fact,
        factType: 'Auto-Extracted',
      }
    })
  )
  return Promise.all(operations)
}

export async function saveMemoryItems(sessionId: string, memories: string[]) {
  const operations = memories.map(memory => 
    prisma.memoryItem.create({
      data: {
        sessionId,
        memoryText: memory,
        memoryType: 'Knowledge',
        importance: 1,
      }
    })
  )
  return Promise.all(operations)
}

// --- Summary & Retrieval Helpers ---
export async function saveCallSummary(sessionId: string, summary: {
  overallIntent: string
  finalSentiment: string
  overallRisk: string
  resolutionStatus: string
  summaryText: string
  followUpAction?: string
}) {
  return prisma.callSummary.create({
    data: {
      sessionId,
      ...summary,
    },
  })
}

export async function getSessionWithTurns(sessionId: string) {
  return prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      turns: {
        include: {
          insight: true,
        },
      },
      extractedFacts: true,
      memoryItems: true,
      summary: true,
    },
  })
}

export async function getSimulationScenarios() {
  return prisma.simulationScenario.findMany({
    orderBy: { createdAt: 'desc' },
  })
}
