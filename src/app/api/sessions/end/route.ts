import { NextResponse } from "next/server";
import { closeSession, updateCustomerAfterCall, saveCallSummary } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { sessionId, customerId, latestInsight } = await req.json();

    // 1. Close session record
    await closeSession(sessionId, latestInsight?.escalation.needed ? 'escalated' : 'completed');

    // 2. Update Customer Profile Counters (Billing, Network, etc.)
    await updateCustomerAfterCall({ customerId, sessionId, latestInsight });

    // 3. Save Final Call Summary
    await saveCallSummary(sessionId, {
      overallIntent: latestInsight?.intent || "General Query",
      finalSentiment: latestInsight?.sentiment || "Neutral",
      overallRisk: latestInsight?.riskLevel || "Low",
      resolutionStatus: latestInsight?.escalation.needed ? 'escalated' : 'resolved',
      summaryText: `Customer reported ${latestInsight?.intent}. Call ended with ${latestInsight?.sentiment} sentiment.`,
      followUpAction: latestInsight?.intent.includes("Billing") ? "Credit verification needed." : "Standard follow-up."
    });

    return NextResponse.json({ status: "Session complete" });
  } catch (error) {
    console.error("Session End Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
