import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'all';

    let where: any = {};
    if (filter === 'escalated') where = { status: 'escalated' };
    if (filter === 'risk') where = { isRiskFlagged: true };

    const sessions = await prisma.session.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: 20,
      include: {
        customer: true,
        summary: true,
        turns: {
          orderBy: { turnIndex: 'desc' },
          take: 1,
          include: {
            insight: true
          }
        }
      }
    });

    return NextResponse.json(sessions);
  } catch (error: any) {
    console.error("Supervisor API Error:", error);
    return NextResponse.json({ error: "Failed to fetch supervisor data" }, { status: 500 });
  }
}
