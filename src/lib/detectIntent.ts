import { MessageTurn } from "./types";

const INTENT_PRECEDENCE = [
  "Churn Risk",
  "Billing Complaint",
  "Network Issue",
  "Complaint Follow-up",
  "General Query"
];

function analyzeSingleTurnIntent(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("cancel") || t.includes("switch") || t.includes("leave") || t.includes("other provider")) return "Churn Risk";
  if (t.includes("billing") || t.includes("charged") || t.includes("cost") || t.includes("payment")) return "Billing Complaint";
  if (t.includes("network") || t.includes("slow") || t.includes("signal") || t.includes("internet") || t.includes("connection")) return "Network Issue";
  if (t.includes("already called") || t.includes("called yesterday") || t.includes("spoke with someone")) return "Complaint Follow-up";
  return "General Query";
}

export function detectIntent(history: MessageTurn[], latest: MessageTurn): string {
  // 1. Collect all customer intents from history + latest
  const customerIntents = [...history, latest]
    .filter(turn => turn.speaker === "customer")
    .map(turn => analyzeSingleTurnIntent(turn.text));

  if (customerIntents.length === 0) {
    return "General Query";
  }

  // 2. Prioritize high-value intents that should be sticky (like Churn or Billing)
  // We pick the "strongest" intent seen so far from the customer
  let strongestIntent = "General Query";
  let maxPrecedence = INTENT_PRECEDENCE.length;

  customerIntents.forEach(intent => {
    const p = INTENT_PRECEDENCE.indexOf(intent);
    if (p !== -1 && p < maxPrecedence) {
      maxPrecedence = p;
      strongestIntent = intent;
    }
  });

  return strongestIntent;
}
