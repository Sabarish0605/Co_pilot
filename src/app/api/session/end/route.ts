import { NextResponse } from "next/server";
import { closeSession, updateCustomerAfterCall, saveCallSummary, saveMemoryItems, getSessionWithTurns } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { sessionId, customerId, latestInsight } = await req.json();

    // 1. Mark completed/escalated
    const status = latestInsight?.escalationRecommended || latestInsight?.escalation?.needed ? 'escalated' : 'completed';
    await closeSession(sessionId, status);

    // 2. Intelligence updates: Summary & Profile
    await updateCustomerAfterCall({ customerId, sessionId, latestInsight });

    // 3. Automated Memory Storage (Important Facts)
    if (latestInsight?.memoryFacts && latestInsight?.memoryFacts.length > 0) {
       await saveMemoryItems(sessionId, latestInsight.memoryFacts);
    }

    // 4. Fetch session to build a rich summary
    const session = await getSessionWithTurns(sessionId);
    
    // 5. Generate Structured Case Summary (PART 3)
    const structuredSummary = {
       caseId: sessionId,
       customerIdentity: {
         id: customerId,
         name: session?.customer?.name || "Unknown",
       },
       intelligenceProfile: {
         intent: latestInsight?.intent || "General Discussion",
         finalSentiment: latestInsight?.sentiment || "Neutral",
         riskLevel: latestInsight?.riskLevel || "Low",
         escalationTriggered: status === 'escalated',
         escalationReason: latestInsight?.escalationReason || latestInsight?.escalation?.reason,
       },
       extractedFacts: session?.extractedFacts.map(f => f.factValue) || [],
       policyAudit: {
          lastStatus: latestInsight?.policyBoundaryStatus || "SAFE",
          reason: latestInsight?.policyReason || "No policy friction detected",
       },
       recommendations: {
          nextAction: latestInsight?.suggestions?.[0]?.text || "Standard follow-up",
          followUpNeeded: status === 'escalated',
       }
    };

    // 6. Persistence for analytics
    await saveCallSummary(sessionId, {
      overallIntent: latestInsight?.intent || "General Discussion",
      finalSentiment: latestInsight?.sentiment || "Neutral",
      overallRisk: latestInsight?.riskLevel || "Low",
      resolutionStatus: status,
      summaryText: `Customer spoke about ${latestInsight?.intent}. Session was ${status}.`,
      structuredSummary: JSON.stringify(structuredSummary),
      commitmentsMade: JSON.stringify({
         allowed: latestInsight?.policyBoundaryStatus === 'safe',
         escalationTriggered: status === 'escalated'
      })
    });

    return NextResponse.json({ 
      success: true, 
      caseSummary: structuredSummary // Return for immediate UI display
    });
  } catch (error: any) {
    console.error("End Session API Error:", error);
    return NextResponse.json({ error: "End session failed" }, { status: 500 });
  }
}
