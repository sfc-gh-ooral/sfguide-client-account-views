import type { AdvisorId } from '@/lib/types';

// Two advisors from the synthetic book. "Viewing as" switches which book the API scopes to.
export const ADVISORS: Record<AdvisorId, { name: string; initials: string; title: string; branch: string; storyAccount: string }> = {
  'ADV-0017': { name: 'Priya Castellane', initials: 'PC', title: 'Senior Wealth Advisor', branch: 'BR-018 · Midwest', storyAccount: 'AC-000417' },
  'ADV-0128': { name: 'Theo Marchbank', initials: 'TM', title: 'Wealth Advisor', branch: 'BR-009 · Southwest', storyAccount: 'AC-000128' },
};
export const ADVISOR_IDS = Object.keys(ADVISORS) as AdvisorId[];
export const isAdvisorId = (x: unknown): x is AdvisorId => typeof x === 'string' && x in ADVISORS;
