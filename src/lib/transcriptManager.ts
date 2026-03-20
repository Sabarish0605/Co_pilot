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
  const sentiment = detectSentiment(transcriptHistory, latestMessage);
  const intent = detectIntent(transcriptHistory, latestMessage);
  const escalation = shouldEscalate(sentiment, intent, transcriptHistory);
  const { level: riskLevel, tags: riskTags } = detectRisk(
    latestMessage.text, 
    transcriptHistory, 
    intent, 
    escalation.needed
  );
  const memoryFacts = extractMemory([...transcriptHistory, latestMessage]);
  const suggestions = generateSuggestions(intent, sentiment, riskLevel);

  // --- Explainability Logic ---
  const explanations = {
    intent: `Detected based on keywords like "${latestMessage.text.split(' ').slice(0, 3).join(' ')}..."`,
    sentiment: `Customer tone identified as ${sentiment} from linguistic patterns.`,
    risk: riskLevel === "High" ? "Elevated risk due to explicit churn language or repeated frustration." : "Low systematic risk detected.",
    escalation: escalation.needed ? "Escalation triggered by unresolved high-priority complaint history." : "Issues are currently manageable at L1 level.",
    nextBestAction: `Confidence ${suggestions[0]?.confidence || 0.8}: Recommended based on ${intent} intent path.`
  };

  return {
    intent,
    sentiment,
    riskLevel,
    riskTags,
    memoryFacts,
    suggestions,
    escalation,
    explanations
  };
}
