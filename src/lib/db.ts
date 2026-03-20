import { prisma } from './prisma'
import { MessageTurn, CopilotOutput } from './types'

// --- Customer Helpers ---
export async function getCustomerByPhoneNumber(phoneNumber: string) {
  return prisma.customer.findUnique({
    where: { phoneNumber }
  })
}

export async function getOrCreateCustomerByPhoneNumber(data: {
  phoneNumber: string
  name?: string
  region?: string
  planType?: string
}) {
  return prisma.customer.upsert({
    where: { phoneNumber: data.phoneNumber },
    update: {},
    create: {
      phoneNumber: data.phoneNumber,
      name: data.name || "Unknown Customer",
      region: data.region || "Default Region",
      planType: data.planType || "Prepaid",
    }
  })
}

export async function getCustomerProfile(customerId: string) {
  return prisma.customer.findUnique({
    where: { id: customerId }
  })
}

export async function getRecentCustomerSessions(customerId: string, limit: number = 5) {
  return prisma.session.findMany({
    where: { customerId },
    orderBy: { startedAt: 'desc' },
    take: limit,
    include: { turns: { include: { insight: true } }, summary: true }
  })
}

// --- Context Builder ---
export function buildRelevantCustomerContext(data: {
  customer: any,
  recentSessions: any[],
  currentUtterance: string
}) {
  const { customer, recentSessions, currentUtterance } = data;
  const t = currentUtterance.toLowerCase();

  const history = {
    billingIssues: customer.billingIssueCount,
    networkIssues: customer.networkIssueCount,
    escalations: customer.escalationCount
  };

  const personalizationHints: string[] = [];
  const retentionSignals: string[] = [];
  let recommendedTone: "neutral" | "empathetic" | "assertive" | "premium" = "neutral";

  // Logic for Telecom scenarios
  if (customer.vipStatus) {
    personalizationHints.push("VIP Customer: Use premium handling and direct routing.");
    recommendedTone = "premium";
  }

  if (customer.churnRiskScore > 0.7) {
    retentionSignals.push("CRITICAL CHURN RISK: Customer has high dissatisfaction history.");
    recommendedTone = "empathetic";
  }

  if (t.includes("bill") || t.includes("charge")) {
    if (history.billingIssues > 2) {
      personalizationHints.push("Repeated billing issues: Customer is likely frustrated with previous resolutions.");
      recommendedTone = "empathetic";
    }
  }

  return {
    customerSnapshot: {
      name: customer.name,
      planType: customer.planType,
      region: customer.region,
      vipStatus: customer.vipStatus,
      churnRisk: customer.churnRisk
    },
    supportHistory: history,
    relevantMemories: [], // Could pull from MemoryItem table
    personalizationHints,
    retentionSignals,
    recommendedTone
  };
}

// --- Call End Updater ---
export async function updateCustomerAfterCall(data: {
  customerId: string,
  sessionId: string,
  latestInsight?: CopilotOutput
}) {
  const { customerId, latestInsight } = data;
  if (!latestInsight) return;

  const updateData: any = {
    lastSentiment: latestInsight.sentiment,
    totalComplaints: { increment: 1 }
  };

  // Telecom specific logic
  if (latestInsight.intent.includes("Billing")) {
    updateData.billingIssueCount = { increment: 1 };
    updateData.lastComplaintCategory = "Billing";
  } else if (latestInsight.intent.includes("Network")) {
    updateData.networkIssueCount = { increment: 1 };
    updateData.lastComplaintCategory = "Network";
  }

  if (latestInsight.riskLevel === "High") {
    updateData.churnRisk = { set: 0.8 }; // Simplistic risk bump
  }

  if (latestInsight.escalation.needed) {
    updateData.escalationCount = { increment: 1 };
  }

  return prisma.customer.update({
    where: { id: customerId },
    data: updateData
  });
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

export async function saveExtractedFacts(sessionId: string, turnId: string, facts: string[]) {
  const operations = facts.map(fact => 
    prisma.extractedFact.create({
      data: {
        sessionId,
        turnId,
        factKey: 'extracted_fact',
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
