import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Priority for .env.local, fallback to provided key for immediate fix
    const apiKey = process.env.DEEPGRAM_API_KEY || "c85a600aa1e455de0c1eea1deeb643c3dd93f2f9";
    
    if (!apiKey) {
      return NextResponse.json({ error: "DEEPGRAM_API_KEY not set in backend environment" }, { status: 500 });
    }

    return NextResponse.json({ token: apiKey });
  } catch (error) {
    console.error("Deepgram Token Error:", error);
    return NextResponse.json({ error: "Failed to retrieve token" }, { status: 500 });
  }
}
