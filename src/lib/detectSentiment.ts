import { MessageTurn } from "./types";

export type SentimentType = "Neutral" | "Mildly Frustrated" | "Frustrated" | "Angry";

function analyzeTurnSentiment(text: string): SentimentType {
  const t = text.toLowerCase();
  const angerKeywords = ["terrible", "horrible", "awful", "pissed", "ridiculous", "unacceptable", "furious", "now", "manager", "supervisor"];
  const frustratedKeywords = ["frustrated", "annoyed", "useless", "disappointed", "waiting", "too long", "again", "nothing"];
  const mildKeywords = ["unfortunately", "not happy", "expected more", "problem"];

  if (angerKeywords.some(kw => t.includes(kw)) || (t.toUpperCase() === t && t.length > 10)) {
    return "Angry";
  } else if (frustratedKeywords.some(kw => t.includes(kw))) {
    return "Frustrated";
  } else if (mildKeywords.some(kw => t.includes(kw))) {
    return "Mildly Frustrated";
  }
  return "Neutral";
}

export function detectSentiment(history: MessageTurn[], latest: MessageTurn): SentimentType {
  // 1. Get all customer turns
  const customerTurns = [...history, latest].filter(turn => turn.speaker === "customer");
  
  if (customerTurns.length === 0) return "Neutral";

  // 2. Analyze the latest customer sentiment as primary
  const latestCustomerTurn = customerTurns[customerTurns.length - 1];
  const detected = analyzeTurnSentiment(latestCustomerTurn.text);

  // 3. Apply worsening sentiment logic (based on history)
  if (customerTurns.length > 1) {
    const previousCustomerTurn = customerTurns[customerTurns.length - 2];
    const prevText = previousCustomerTurn.text.toLowerCase();
    const frustratedKeywords = ["frustrated", "annoyed", "useless", "disappointed", "waiting", "too long", "again", "nothing"];
    const prevIsFrustrated = frustratedKeywords.some(kw => prevText.includes(kw));
    
    if (detected === "Frustrated" && prevIsFrustrated) {
      return "Angry"; // Repeated frustration escalates
    }
  }
  
  return detected;
}
