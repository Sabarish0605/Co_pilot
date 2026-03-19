export function generateSuggestions(intent: string, sentiment: string, riskLevel: string) {
  const suggestions = [];

  if (sentiment === "Angry" || sentiment === "Frustrated") {
    suggestions.push({
      rank: 1,
      type: "Empathy" as const,
      text: "Acknowledge frustration and apologize for the inconvenience promptly.",
      confidence: 0.95
    });
  } else {
    suggestions.push({
      rank: 1,
      type: "Clarification" as const,
      text: "Confirm details of the query to ensure accurate assistance.",
      confidence: 0.8
    });
  }

  if (intent === "Billing Complaint") {
    suggestions.push({
      rank: 2,
      type: "Resolution" as const,
      text: "Explain the current billing cycle and offer to review the line items with the customer.",
      confidence: 0.9
    });
  } else if (intent === "Network Issue") {
    suggestions.push({
      rank: 2,
      type: "Resolution" as const,
      text: "Run a remote diagnostic test on the customer's line/device.",
      confidence: 0.85
    });
  } else {
    suggestions.push({
      rank: 2,
      type: "Clarification" as const,
      text: "Ask follow-up questions to narrow down the issue.",
      confidence: 0.75
    });
  }

  if (riskLevel === "High") {
    suggestions.push({
      rank: 3,
      type: "Retention" as const,
      text: "Offer a small credit or loyalty discount to mitigate churn risk.",
      confidence: 0.8
    });
  } else if (sentiment === "Angry") {
    suggestions.push({
      rank: 3,
      type: "Escalation" as const,
      text: "Offer to connect the customer with a supervisor.",
      confidence: 0.9
    });
  }

  // Ensure unique ranks and at most 3 suggestions
  return suggestions.slice(0, 3).map((s, idx) => ({ ...s, rank: idx + 1 }));
}
