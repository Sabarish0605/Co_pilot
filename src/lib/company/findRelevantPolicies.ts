import { loadPolicies } from './loadPolicies'
import { PolicyCategory, PolicyContext } from './policyTypes'

export function findRelevantPolicies(utterance: string): PolicyContext {
  const policies = loadPolicies();
  const lowerUtterance = (utterance || "").toLowerCase();

  // 1. Identify relevant categories using keywords
  const matchedCategories = (policies.policyCategories || []).filter(category => {
    const keywords = category.keywords || [];
    return keywords.some(kw => lowerUtterance.includes(kw.toLowerCase())) ||
           (category.category || "").toLowerCase().includes(lowerUtterance) ||
           (category.title || "").toLowerCase().includes(lowerUtterance);
  });

  // 2. Extract specific relevant rules
  const rules = policies.globalAgentRules || {};
  const globalRules = (rules.allowedGeneralBehaviors || []).slice(0, 5);
  const forbiddenCommitments = (rules.forbiddenGeneralBehaviors || []).slice(0, 5);
  
  // 3. Compile context
  return {
    matchedCategories: matchedCategories.slice(0, 2),
    globalRules,
    forbiddenCommitments,
    safeGuidance: matchedCategories.flatMap(c => c.safeResponseGuidance || []).slice(0, 3),
    escalationIndicators: (rules.whenToEscalate || []).slice(0, 4)
  };
}
