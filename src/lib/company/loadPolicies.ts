import fs from 'fs'
import path from 'path'
import { CompanyPolicies } from './policyTypes'

let cachedPolicies: CompanyPolicies | null = null;

export function loadPolicies(): CompanyPolicies {
  if (cachedPolicies) return cachedPolicies;

  const policyPath = path.join(process.cwd(), 'data', 'company', 'policies.json');
  try {
    const data = fs.readFileSync(policyPath, 'utf8');
    cachedPolicies = JSON.parse(data) as CompanyPolicies;
    return cachedPolicies;
  } catch (error) {
    console.error("Failed to load policies.json from:", policyPath, error);
    // Return empty but typed fallback to prevent crashes
    return {
      companyProfile: {
        companyName: "Telco Support",
        brandName: "Support AI",
        supportChannels: {},
        customerTypes: {},
        escalationTeams: {}
      },
      globalAgentRules: {
        allowedGeneralBehaviors: [],
        forbiddenGeneralBehaviors: [],
        mandatoryDisclosures: {},
        promiseRestrictions: {},
        whenToEscalate: []
      },
      policyCategories: []
    };
  }
}
