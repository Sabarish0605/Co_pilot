import { NextResponse } from "next/server";
import { MessageTurn } from "@/lib/types";
import { analyzeConversation } from "@/lib/transcriptManager";
import { findRelevantPolicies } from "@/lib/company/findRelevantPolicies";
import { checkPolicyBoundaries } from "@/lib/company/checkPolicyBoundaries";
import { buildFactualAnswerContext } from "@/lib/customer/buildFactualAnswerContext";
import { 
  saveConversationTurn, 
  saveCopilotInsight, 
  getOrCreateCustomerByPhoneNumber,
  buildRelevantCustomerContext,
  getCustomerMemories,
  getRecentCustomerSessions
} from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { transcriptHistory, latestMessage, sessionId, phoneNumber, customerId } = body;
    console.log("[Orchestrator] Turn for session:", sessionId);

    if (!latestMessage) {
      return NextResponse.json({ error: "Missing latestMessage" }, { status: 400 });
    }

    // 1. Resolve Identity & Context
    let customerContext = body.customerContext;
    let customerResult = null;
    if (!customerContext && (phoneNumber || customerId)) {
      customerResult = await getOrCreateCustomerByPhoneNumber({ phoneNumber: phoneNumber || "" });
      const recentSessions = await getRecentCustomerSessions(customerResult.id);
      const memories = await getCustomerMemories(customerResult.id);
      
      customerContext = buildRelevantCustomerContext({ 
        customer: customerResult, 
        recentSessions, 
        memories,
        currentUtterance: latestMessage.text 
      });
    }

    // 2. Intelligence & Policy Grounding
    const relevantPolicies = findRelevantPolicies(latestMessage.text);
    const policyStatus = checkPolicyBoundaries(latestMessage.text, relevantPolicies.matchedCategories);
    const factualContext = buildFactualAnswerContext(latestMessage.text, customerContext);

    // 3. AI Copilot Analysis
    const copilotOutput = analyzeConversation(transcriptHistory, latestMessage);
    // Enrich copilot output
    copilotOutput.policyBoundaryStatus = policyStatus.boundaryStatus;
    copilotOutput.policyReason = policyStatus.reason;
    copilotOutput.escalationRecommended = policyStatus.escalationRecommended;
    copilotOutput.escalationReason = policyStatus.escalationReason;

    // 4. Intelligence Observability / Audit Trail (PART 1)
    const auditTrail = {
      loadedCustomer: customerContext?.customerSnapshot.name || "Unknown",
      usedPolicies: relevantPolicies.matchedCategories.map(c => c.title),
      selectedMemories: customerContext?.relevantMemories?.slice(0, 3) || [],
      factualStatements: factualContext.isFactualQuery ? factualContext.factualStatement : "N/A",
      riskSignal: copilotOutput.riskLevel,
      boundaryStatus: policyStatus.boundaryStatus,
      escalationReason: policyStatus.escalationReason || "No escalation",
      safeGuidance: policyStatus.safeGuidance,
      forbiddenPromises: policyStatus.forbiddenProhibited,
      policyRestrictedAction: policyStatus.boundaryStatus !== 'safe'
    };

    // 5. AI Agent Calling with Grounding
    let agentReply = "I'm having trouble connecting to my response module.";
    
    const groundingContext = `
[Grounded Intelligence]
Customer Name: ${customerContext?.customerSnapshot.name}
Last Call Intent: ${customerContext?.supportHistory.lastComplaintCategory}
Last Call Summary: ${customerContext?.lastSessionSummary}
Memories: ${customerContext?.relevantMemories?.join('. ')}
${factualContext.isFactualQuery ? factualContext.factualStatement : ""}

[Policy Guidance]
Boundary: ${policyStatus.boundaryStatus}
Relevance: ${relevantPolicies.matchedCategories.map(c => c.title).join(', ')}
${policyStatus.escalationRecommended ? "Escalation Flagged: " + policyStatus.escalationReason : ""}
Allowed Actions: ${policyStatus.safeGuidance.join('; ')}
FORBIDDEN COMMITMENTS: ${policyStatus.forbiddenProhibited.join('; ')}
    `.trim();

    try {
      const agentResp = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: latestMessage.text,
          sessionId: sessionId || "live-call",
          context: groundingContext
        }),
        signal: AbortSignal.timeout(5000), 
      });

      if (agentResp.ok) {
        const agentData = await agentResp.json();
        agentReply = agentData.text;
        
        fetch("http://localhost:8000/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: agentReply }),
        }).catch(err => console.error("TTS Trigger failed:", err));
      }
    } catch (err) {
      console.warn("[Orchestrator] AI Agent offline.");
    }

    // 6. Persist Turn
    if (sessionId) {
      try {
        const turn = await saveConversationTurn({
          sessionId,
          turnIndex: transcriptHistory.length,
          customerText: latestMessage.text,
          agentReply: agentReply,
          sourceType: 'live'
        });
        await saveCopilotInsight(turn.id, copilotOutput);
      } catch (dbErr) {
        console.error("[Orchestrator] DB Save Error:", dbErr);
      }
    }

    return NextResponse.json({
      copilot: copilotOutput,
      agent: { reply: agentReply },
      customerContext,
      auditTrail // Added for Observability Layer
    });

  } catch (error: any) {
    console.error("Orchestrator Error:", error);
    return NextResponse.json({ error: error.message || "Internal Error" }, { status: 500 });
  }
}
