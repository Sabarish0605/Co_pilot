import { MessageTurn } from "./types";

export function extractMemory(history: MessageTurn[]): string[] {
  const facts: string[] = [];
  
  history.filter(turn => turn.speaker === "customer").forEach(turn => {
    const text = turn.text.toLowerCase();
    
    if (text.includes("already called")) {
      facts.push("Customer already called before");
    }
    if (text.includes("restarted") || text.includes("reset")) {
      if (text.includes("router") || text.includes("modem") || text.includes("phone")) {
        facts.push("Customer already restarted device");
      }
    }
    if (text.includes("charged twice") || text.includes("double charge")) {
      facts.push("Customer mentioned duplicate billing");
    }
    if (text.includes("travel") || text.includes("roaming")) {
      facts.push("Customer is traveling");
    }
  });

  // Unique facts
  return Array.from(new Set(facts));
}
