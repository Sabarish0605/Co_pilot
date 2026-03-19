import { MessageTurn } from "./types";

export function detectRisk(
  latestText: string, 
  history: MessageTurn[], 
  intent: string, 
  escalationNeeded: boolean
): { level: "Low" | "Medium" | "High", tags: string[] } {
  const t = latestText.toLowerCase();
  const tags: string[] = [];
  
  // 1. Tagging based on keywords and history
  if (intent === "Churn Risk") {
    tags.push("Churn Risk");
  }
  
  const repeatInText = t.includes("already called") || t.includes("yesterday") || t.includes("second time");
  const repeatInHistory = history.some(h => h.speaker === "customer" && h.text.toLowerCase().includes("already called"));
  if (repeatInText || repeatInHistory) {
    tags.push("Repeat Caller");
  }

  if (t.includes("supervisor") || t.includes("manager") || t.includes("better than this")) {
    tags.push("Escalation Risk");
  }

  // 2. Consistency logic:
  let level: "Low" | "Medium" | "High" = "Low";
  
  if (escalationNeeded || tags.includes("Churn Risk")) {
    level = "High";
  } else if (tags.length > 0 || intent === "Complaint Follow-up") {
    level = "Medium";
  }

  return { level, tags };
}
