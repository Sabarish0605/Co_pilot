import { NextResponse } from "next/server";
import { MessageTurn } from "@/lib/types";
import { analyzeConversation } from "@/lib/transcriptManager";
import { 
  saveConversationTurn, 
  saveCopilotInsight, 
  getOrCreateCustomerByPhoneNumber,
  buildRelevantCustomerContext
} from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { transcriptHistory, latestMessage, sessionId, phoneNumber } = body;
    console.log("[Orchestrator] Request Body:", JSON.stringify(body).slice(0, 100) + "...");

    if (!latestMessage) {
      return NextResponse.json({ error: "Missing latestMessage" }, { status: 400 });
    }

    // 1. Resolve Customer Identity
    let customerContext = null;
    let customerId = null;

    if (phoneNumber) {
      console.log("[Orchestrator] Resolving customer for phone:", phoneNumber);
      const customer = await getOrCreateCustomerByPhoneNumber({ phoneNumber });
      customerId = customer.id;
      customerContext = buildRelevantCustomerContext({ 
        customer, 
        recentSessions: [], 
        currentUtterance: latestMessage.text 
      });
      console.log("[Orchestrator] Customer Context generated.");
    }

    // 2. Run Copilot Analysis
    console.log("[Orchestrator] Analyzing conversation...");
    const copilotOutput = analyzeConversation(transcriptHistory, latestMessage);

    // 3. Call AI Agent
    console.log("[Orchestrator] Calling AI Agent...");
    let agentReply = "I'm having trouble connecting to my response module.";
    
    try {
      const agentResp = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: latestMessage.text,
          context: customerContext?.personalizationHints?.join(' ')
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

    // 4. Persist Turn
    if (sessionId) {
      console.log("[Orchestrator] Persisting turn metadata for session:", sessionId);
      try {
        const turn = await saveConversationTurn({
          sessionId,
          turnIndex: transcriptHistory.length,
          customerText: latestMessage.text,
          agentReply: agentReply,
          sourceType: 'live'
        });
        await saveCopilotInsight(turn.id, copilotOutput);
        console.log("[Orchestrator] Persistence complete.");
      } catch (dbErr) {
        console.error("[Orchestrator] DB Save Error:", dbErr);
      }
    }

    return NextResponse.json({
      copilot: copilotOutput,
      agent: { reply: agentReply },
      customerContext
    });

  } catch (error: any) {
    console.error("Orchestrator Error:", error);
    return NextResponse.json({ error: error.message || "Internal Error" }, { status: 500 });
  }
}
