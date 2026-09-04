// lib/plans.ts
// Menm valè '30days' | '90days' | '1year' ak LicenseDuration nan lib/license.ts
export type PlanId = '30days' | '90days' | '1year';

export interface Plan {
  id: PlanId;
  label: string;
  amount: number;        // HTG
  durationLabel: string;
}

export const PLANS: Record<PlanId, Plan> = {
  '30days': { id: '30days', label: '30 jou', amount: 1000,  durationLabel: '30 jou' },
  '90days': { id: '90days', label: '90 jou', amount: 2500,  durationLabel: '90 jou' },
  '1year':  { id: '1year',  label: '1 an',   amount: 10000, durationLabel: '1 an'  },
};

export function getPlan(id: string): Plan | null {
  return (PLANS as Record<string, Plan>)[id] ?? null;
}