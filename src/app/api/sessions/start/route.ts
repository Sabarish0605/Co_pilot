import { NextResponse } from "next/server";
import { getOrCreateCustomerByPhoneNumber, createSession } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { phoneNumber, channelType } = await req.json();
    console.log("[Session Start] Phone:", phoneNumber, "Channel:", channelType);
    
    const customer = await getOrCreateCustomerByPhoneNumber({ phoneNumber });
    console.log("[Session Start] Resolved Customer:", customer.id);
    
    const session = await createSession({ customerId: customer.id, channelType });
    console.log("[Session Start] Session Created:", session.id);

    return NextResponse.json({ sessionId: session.id, customerId: customer.id });
  } catch (error: any) {
    console.error("Session Start Error:", error);
    return NextResponse.json({ error: error.message || "Internal Error" }, { status: 500 });
  }
}
