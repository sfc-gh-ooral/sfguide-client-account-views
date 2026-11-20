'use client';

// Shared app state: which advisor's book is in view, the data source, and the timings of the
// last account page (drawn as the strip under the navigation on every screen).
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { isLive } from '@/lib/client';
import { ADVISOR_IDS, isAdvisorId } from '@/lib/personas';
import type { AdvisorId, Timings } from '@/lib/types';

interface State {
  advisor: AdvisorId; setAdvisor: (a: AdvisorId) => void;
  live: boolean | undefined;
  lastTimings: Timings | undefined; setLastTimings: (t: Timings | undefined) => void;
}
const Ctx = createContext<State | null>(null);
const KEY = 'qs-advisor';

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [advisor, setAdvisorState] = useState<AdvisorId>(ADVISOR_IDS[0]);
  const [live, setLive] = useState<boolean>();
  const [lastTimings, setLastTimings] = useState<Timings>();
  useEffect(() => {
    const saved = window.localStorage.getItem(KEY);
    if (isAdvisorId(saved)) setAdvisorState(saved);
    isLive().then(setLive);
  }, []);
  const setAdvisor = useCallback((a: AdvisorId) => { window.localStorage.setItem(KEY, a); setAdvisorState(a); }, []);
  return <Ctx.Provider value={{ advisor, setAdvisor, live, lastTimings, setLastTimings }}>{children}</Ctx.Provider>;
}

export function useAppState(): State {
  const s = useContext(Ctx);
  if (!s) throw new Error('useAppState outside provider');
  return s;
}
