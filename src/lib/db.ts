import { prisma } from './prisma'
import { MessageTurn, CopilotOutput } from './types'

// --- Utility ---
export function normalizePhoneNumber(phoneNumber: string) {
  // Simple hackathon normalization: keep only digits
  return phoneNumber.replace(/\D/g, '')
}

// --- Customer Helpers ---
export async function getCustomerByPhoneNumber(phoneNumber: string) {
  const norm = normalizePhoneNumber(phoneNumber);
  return prisma.customer.findUnique({
    where: { phoneNumber: norm }
  })
}

export async function getOrCreateCustomerByPhoneNumber(data: {
  phoneNumber: string
  name?: string
  region?: string
  planType?: string
}) {
  const norm = normalizePhoneNumber(data.phoneNumber);
  return prisma.customer.upsert({
    where: { phoneNumber: norm },
    update: {},
    create: {
      phoneNumber: norm,
      name: data.name || "Customer_" + norm.slice(-4),
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

export async function getRecentCustomerSessions(customerId: string, limit: number = 3) {
  return prisma.session.findMany({
    where: { customerId },
    orderBy: { startedAt: 'desc' },
    take: limit,
    include: { summary: true }
  })
}

export async function getCustomerMemories(customerId: string, limit: number = 10) {
  // Prisma relation: MemoryItem -> Session -> Customer
  return prisma.memoryItem.findMany({
    where: { session: { customerId } },
    orderBy: { createdAt: 'desc' },
    take: limit
  })
}

// --- Context Builder ---
export function buildRelevantCustomerContext(data: {
  customer: any,
  recentSessions: any[],
  memories: any[],
  currentUtterance: string
}) {
  const { customer, recentSessions, memories, currentUtterance } = data;
  const t = currentUtterance.toLowerCase();

  const history = {
    totalComplaints: customer.totalComplaints,
    lastComplaintCategory: customer.lastComplaintCategory,
    billingIssues: customer.billingIssueCount,
    networkIssues: customer.networkIssueCount,
    escalations: customer.escalationCount,
    churnRisk: customer.churnRisk
  };

  const personalizationHints: string[] = [];
  const retentionSignals: string[] = [];
  let recommendedTone: "neutral" | "empathetic" | "assertive" | "premium" = "neutral";

  // Logic for Telecom scenarios
  if (customer.vipStatus) {
    personalizationHints.push("VIP Customer: Prioritize loyalty and avoid generic troubleshooting script.");
    recommendedTone = "premium";
  }

  if (customer.churnRisk > 0.6) {
    retentionSignals.push("CHURN WARNING: Customer has mentioned port-out or cancellation recently.");
    recommendedTone = "empathetic";
  }

  // Use recent memories for context
  const relevantMemories = memories
    .filter(m => t.split(' ').some(word => word.length > 3 && m.memoryText.toLowerCase().includes(word)))
    .map(m => m.memoryText);

  if (t.includes("bill") || t.includes("charge")) {
    if (history.billingIssues > 2) {
      personalizationHints.push("History of multiple billing disputes. Likely skeptical of automated billing explanations.");
      recommendedTone = "empathetic";
    }
  }

  return {
    customerSnapshot: {
      name: customer.name,
      phoneNumber: customer.phoneNumber,
      currentPlan: customer.planType,
      region: customer.region,
      preferredLanguage: customer.preferredLanguage,
      vipStatus: customer.vipStatus
    },
    supportHistory: {
      totalComplaints: history.totalComplaints,
      lastComplaintCategory: history.lastComplaintCategory,
      churnRiskScore: history.churnRisk,
      repeatedIssueCount: customer.repeatedIssueCount
    },
    relevantMemories,
    personalizationHints,
    retentionSignals,
    recommendedTone,
    lastSessionSummary: recentSessions[0]?.summary?.summaryText || "No previous session summary available."
  };
}

// --- Call End Updater ---
export async function updateCustomerAfterCall(data: {
  customerId: string,
  sessionId: string,
  latestInsight?: CopilotOutput
}) {
  const { customerId, sessionId, latestInsight } = data;
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

  // Update Memory: If high importance fact exists
  if (latestInsight.memoryFacts && latestInsight.memoryFacts.length > 0) {
    await prisma.memoryItem.create({
      data: {
        sessionId,
        memoryText: latestInsight.memoryFacts[0],
        memoryType: 'Knowledge',
        importance: 2
      }
    });
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
      escalationRecommended: insight.escalationRecommended || insight.escalation.needed,
      escalationReason: insight.escalationReason || insight.escalation.reason,
      confidenceScore: insight.suggestions[0]?.confidence || 1.0,
      policyBoundaryStatus: insight.policyBoundaryStatus,
      policyReason: insight.policyReason,
      policyEscalationTriggered: insight.escalationRecommended,
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
  structuredSummary?: string
  commitmentsMade?: string
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
