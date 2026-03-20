import { NextResponse } from "next/server";
import { MessageTurn } from "@/lib/types";
import { analyzeConversation } from "@/lib/transcriptManager";
import { saveConversationTurn, saveCopilotInsight } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { transcriptHistory, latestMessage, sessionId } = await req.json();

    if (!latestMessage) {
      return NextResponse.json({ error: "Missing latestMessage" }, { status: 400 });
    }

    // 1. Run Copilot Analysis (Local Logic)
    const copilotOutput = analyzeConversation(transcriptHistory, latestMessage);

    // 2. Call AI Agent (Python/FastAPI Logic from shared1)
    let agentReply = "I'm having trouble connecting to my response module. How can I help you today?";
    
    try {
      const agentResp = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: latestMessage.text }),
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
      console.warn("AI Agent (shared1) is offline. Using fallback reply.");
    }

    // 3. Persist to SQLite if Session ID is provided
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
        console.error("Database Save Error:", dbErr);
      }
    }

    return NextResponse.json({
      copilot: copilotOutput,
      agent: {
        reply: agentReply
      }
    });

  } catch (error) {
    console.error("Orchestrator Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
