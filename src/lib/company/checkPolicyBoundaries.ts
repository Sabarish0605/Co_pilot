import { PolicyCategory, CompanyPolicies } from './policyTypes'
import { loadPolicies } from './loadPolicies'

export interface PolicyStatus {
  boundaryStatus: 'safe' | 'caution' | 'crossed'
  reason: string
  escalationRecommended: boolean
  escalationReason: string
  safeGuidance: string[]
  forbiddenProhibited: string[]
}

export function checkPolicyBoundaries(
  utterance: string,
  matchedCategories: PolicyCategory[]
): PolicyStatus {
  const policies = loadPolicies();
  const lower = (utterance || "").toLowerCase();
  
  let status: 'safe' | 'caution' | 'crossed' = 'safe';
  let reason = 'Request falls within standard support boundaries.';
  let escalationRecommended = false;
  let escalationReason = '';

  const rules = policies.globalAgentRules || {};
  const globalEscalationTriggers = rules.whenToEscalate || [];

  // 1. Detect Escalation Triggers from Global Rules
  const triggeredGlobal = globalEscalationTriggers.find(trigger => 
    lower.includes(trigger.toLowerCase())
  );

  if (triggeredGlobal) {
    status = 'crossed';
    escalationRecommended = true;
    escalationReason = `Escalation trigger detected: ${triggeredGlobal}`;
  }

  // 2. Detect Category-Specific Triggers
  (matchedCategories || []).forEach(category => {
    const matchedTrigger = (category.escalationTriggers || []).find(t => lower.includes(t.toLowerCase()));
    if (matchedTrigger) {
      status = 'crossed';
      escalationRecommended = true;
      escalationReason = `Category policy boundary triggered: ${matchedTrigger}`;
    }

    const matchedUnsupported = (category.unsupportedRequests || []).find(u => lower.includes(u.toLowerCase()));
    if (matchedUnsupported) {
      status = 'caution';
      reason = `Policy note: This request is unsupported: ${matchedUnsupported}`;
    }
  });

  // 3. Detect Keyword-based Caution
  const dangerKeywords = ['refund', 'compensation', 'lawsuit', 'attorney', 'legal', 'sue', 'fcc complaint'];
  if (dangerKeywords.some(kw => lower.includes(kw))) {
    status = (status === 'crossed') ? 'crossed' : 'caution';
    if (status === 'caution') reason = 'Request involves financial or legal claims requiring caution.';
  }

  return {
    boundaryStatus: status,
    reason,
    escalationRecommended,
    escalationReason,
    safeGuidance: (matchedCategories || []).flatMap(c => c.safeResponseGuidance || []).slice(0, 3),
    forbiddenProhibited: (matchedCategories || []).flatMap(c => c.forbiddenPromises || []).slice(0, 3)
  };
}
