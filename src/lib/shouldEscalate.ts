import { MessageTurn } from "./types";

export function shouldEscalate(sentiment: string, intent: string, history: MessageTurn[]) {
  if (sentiment === "Angry") return { needed: true, reason: "Customer is highly angry." };
  if (intent === "Churn Risk") return { needed: true, reason: "High risk of customer churn." };
  
  const repeatCount = history.filter(h => h.speaker === "customer" && h.text.toLowerCase().includes("already called")).length;
  if (repeatCount >= 1) return { needed: true, reason: "Repeated unresolved complaint." };
  
  return { needed: false };
}
