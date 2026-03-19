import { MessageTurn, CopilotOutput } from "./types";
import { detectIntent } from "./detectIntent";
import { detectSentiment } from "./detectSentiment";
import { detectRisk } from "./detectRisk";
import { extractMemory } from "./extractMemory";
import { generateSuggestions } from "./generateSuggestions";
import { shouldEscalate } from "./shouldEscalate";

export function analyzeConversation(
  transcriptHistory: MessageTurn[],
  latestMessage: MessageTurn
): CopilotOutput {
  // 1. Determine Sentiment first
  const sentiment = detectSentiment(transcriptHistory, latestMessage);

  // 2. Determine Intent (Prioritize customer, sticky intent)
  const intent = detectIntent(transcriptHistory, latestMessage);

  // 3. Check for Escalation (Based on current sentiment and intent history)
  const escalation = shouldEscalate(sentiment, intent, transcriptHistory);

  // 4. Determine Risk (Consistent with escalation and intent)
  const { level: riskLevel, tags: riskTags } = detectRisk(
    latestMessage.text, 
    transcriptHistory, 
    intent, 
    escalation.needed
  );

  // 5. Memory Facts (Customer only)
  const memoryFacts = extractMemory([...transcriptHistory, latestMessage]);

  // 6. Suggestions
  const suggestions = generateSuggestions(intent, sentiment, riskLevel);

  return {
    intent,
    sentiment,
    riskLevel,
    riskTags,
    memoryFacts,
    suggestions,
    escalation
  };
}
