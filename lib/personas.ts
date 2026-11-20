import type { AdvisorId } from '@/lib/types';

// Two advisors from the synthetic book. "View as" switches which book the API scopes to.
export const ADVISORS: Record<AdvisorId, { name: string; title: string; label: string; storyAccount: string }> = {
  'ADV-0017': { name: 'Dana Whitfield', title: 'Senior Wealth Advisor · ADV-0017', label: 'Dana', storyAccount: 'AC-000417' },
  'ADV-0128': { name: 'Marcus Delacroix', title: 'Wealth Advisor · ADV-0128', label: 'Marcus', storyAccount: 'AC-000128' },
};
export const ADVISOR_IDS = Object.keys(ADVISORS) as AdvisorId[];
export const isAdvisorId = (x: unknown): x is AdvisorId => typeof x === 'string' && x in ADVISORS;
