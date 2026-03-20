import { CustomerContext } from "../types";

export interface FactualAnswerContext {
  isFactualQuery: boolean;
  queryType: "profile" | "history" | "none";
  factualStatement: string;
}

export function buildFactualAnswerContext(
  utterance: string,
  customerContext: CustomerContext | null
): FactualAnswerContext {
  if (!customerContext) return { isFactualQuery: false, queryType: "none", factualStatement: "" };

  const lower = utterance.toLowerCase();
  
  // Profile patterns
  const nameQuery = lower.includes("my name") || lower.includes("who am i");
  const planQuery = lower.includes("my plan") || lower.includes("what plan") || lower.includes("current plan");
  const phoneQuery = lower.includes("my number") || lower.includes("my phone");

  // History patterns
  const lastCallQuery = lower.includes("last call") || lower.includes("previous call") || lower.includes("talked about before") || lower.includes("last time");
  const issueQuery = lower.includes("previous issue") || lower.includes("my complaint") || lower.includes("my history");

  if (nameQuery || planQuery || phoneQuery) {
    const s = customerContext.customerSnapshot;
    let statement = `[DETERMINISTIC PROFILE DATA]: The customer's name is ${s.name}. Their phone number is ${s.phoneNumber}. Their current plan is ${s.planType}. They are located in ${s.region}. Preferred language is ${s.preferredLanguage}.`;
    return { isFactualQuery: true, queryType: "profile", factualStatement: statement };
  }

  if (lastCallQuery || issueQuery) {
    let statement = `[DETERMINISTIC HISTORY DATA]: In the previous session, the issue was: ${customerContext.supportHistory.lastComplaintCategory}. The summary of that session was: ${customerContext.lastSessionSummary}. Relevant past memories: ${customerContext.relevantMemories?.join('. ')}.`;
    return { isFactualQuery: true, queryType: "history", factualStatement: statement };
  }

  return { isFactualQuery: false, queryType: "none", factualStatement: "" };
}
