import { NextResponse } from "next/server";
import { 
  getOrCreateCustomerByPhoneNumber, 
  createSession, 
  getRecentCustomerSessions, 
  getCustomerMemories,
  buildRelevantCustomerContext 
} from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { phoneNumber, channelType = 'voice' } = await req.json();
    
    // 1. Identify/Create Customer
    const customer = await getOrCreateCustomerByPhoneNumber({ phoneNumber });
    
    // 2. Load History
    const recentSessions = await getRecentCustomerSessions(customer.id);
    const memories = await getCustomerMemories(customer.id);
    
    // 3. Create Session
    const session = await createSession({ customerId: customer.id, channelType });
    
    // 4. Build Context
    const customerContext = buildRelevantCustomerContext({ 
      customer, 
      recentSessions, 
      memories, 
      currentUtterance: "" 
    });

    return NextResponse.json({ 
      customer,
      session,
      customerContext
    });
  } catch (error: any) {
    console.error("Start Session Error:", error);
    return NextResponse.json({ error: error.message || "Internal Error" }, { status: 500 });
  }
}
