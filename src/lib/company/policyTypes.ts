export interface PolicyCategory {
  id: string
  category: string
  title: string
  summary: string
  scope: string
  supportedIssues: string[]
  unsupportedRequests: string[]
  allowedActions: string[]
  forbiddenPromises: string[]
  standardHandlingFlow: string[]
  escalationTriggers: string[]
  safeResponseGuidance: string[]
  keywords: string[]
}

export interface CompanyPolicies {
  companyProfile: {
    companyName: string
    brandName: string
    supportChannels: Record<string, any>
    customerTypes: Record<string, any>
    escalationTeams: Record<string, any>
  }
  globalAgentRules: {
    allowedGeneralBehaviors: string[]
    forbiddenGeneralBehaviors: string[]
    mandatoryDisclosures: Record<string, string>
    promiseRestrictions: Record<string, any>
    whenToEscalate: string[]
  }
  policyCategories: PolicyCategory[]
}

export interface PolicyContext {
  matchedCategories: PolicyCategory[]
  globalRules: string[]
  forbiddenCommitments: string[]
  safeGuidance: string[]
  escalationIndicators: string[]
}
