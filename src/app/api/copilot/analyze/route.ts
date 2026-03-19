import { NextRequest, NextResponse } from "next/server";
import { analyzeConversation } from "@/lib/transcriptManager";
import { MessageTurn } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transcriptHistory, latestMessage } = body;

    // Hardened validation
    if (!latestMessage || typeof latestMessage.text !== 'string' || !latestMessage.speaker) {
      return NextResponse.json(
        { error: "Invalid latestMessage: text (string) and speaker are required." }, 
        { status: 400 }
      );
    }

    if (!Array.isArray(transcriptHistory)) {
       return NextResponse.json(
        { error: "Invalid transcriptHistory: must be an array." }, 
        { status: 400 }
      );
    }

    // Process analysis
    const analysis = analyzeConversation(
      transcriptHistory as MessageTurn[], 
      latestMessage as MessageTurn
    );

    // Return stable, typed response
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Analysis Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
