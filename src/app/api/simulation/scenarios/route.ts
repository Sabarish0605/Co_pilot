import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const scenarios = await prisma.simulationScenario.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(scenarios);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch scenarios" }, { status: 500 });
  }
}
