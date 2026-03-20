import { MessageTurn } from "./types";

export type SentimentType = "Neutral" | "Mildly Frustrated" | "Frustrated" | "Angry";

function analyzeTurnSentimentRaw(text: string): { score: number, type: SentimentType } {
  const t = text.toLowerCase();
  
  const intensityMap: Record<string, number> = {
    // Anger (High intensity)
    "terrible": 3, "horrible": 3, "pissed": 3, "unacceptable": 3, "shitty": 3, "useless": 3, 
    "furious": 3, "stupid": 2.5, "ridiculous": 2.5, "manager": 2, "supervisor": 2, "cancel": 3,
    "sue": 3, "lawsuit": 3, "scam": 3, "garbage": 3, "wtf": 3, "now": 1.5,
    
    // Frustration (Medium intensity)
    "frustrated": 2, "annoyed": 2, "disappointed": 1.5, "waiting": 1.5, "too long": 1.5, 
    "nothing": 1, "fixing": 1, "still": 1, "waste my time": 2, "don't help": 1.5,
    "expected more": 1.5, "joke": 2, "worst": 2, "slow": 1, "never": 1.5,
    
    // Mild (Low intensity)
    "unfortunately": 0.5, "not happy": 0.8, "problem": 0.5, "issue": 0.3, "broken": 0.5
  };

  let totalScore = 0;
  Object.keys(intensityMap).forEach(kw => {
    if (t.includes(kw)) totalScore += intensityMap[kw];
  });

  // Caps check
  if (t.toUpperCase() === text && text.length > 5) totalScore += 2;

  if (totalScore >= 4) return { score: totalScore, type: "Angry" };
  if (totalScore >= 2) return { score: totalScore, type: "Frustrated" };
  if (totalScore >= 0.8) return { score: totalScore, type: "Mildly Frustrated" };
  return { score: totalScore, type: "Neutral" };
}

export function detectSentiment(history: MessageTurn[], latest: MessageTurn): SentimentType {
  const customerTurns = [...history, latest].filter(turn => turn.speaker === "customer");
  if (customerTurns.length === 0) return "Neutral";

  // Analyze latest
  const { score: latestScore, type: latestType } = analyzeTurnSentimentRaw(latest.text);

  // Analyze trend (last 3 turns)
  const recentTurns = customerTurns.slice(-3);
  const totalRecentScore = recentTurns.reduce((acc, turn) => acc + analyzeTurnSentimentRaw(turn.text).score, 0);

  // If recent average is high, elevate the current sentiment
  const averageRecentScore = totalRecentScore / recentTurns.length;

  if (latestType === "Angry" || averageRecentScore >= 3) return "Angry";
  if (latestType === "Frustrated" || averageRecentScore >= 1.8) return "Frustrated";
  if (latestType === "Mildly Frustrated" || averageRecentScore >= 0.8) return "Mildly Frustrated";

  return "Neutral";
}
