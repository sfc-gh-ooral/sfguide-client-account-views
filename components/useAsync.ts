'use client';

import { useCallback, useEffect, useState } from 'react';

/** Loads async data and reloads when deps change. `reload` re-runs it on demand. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let on = true;
    setState({ loading: true }); // drop the previous advisor's data so it never shows under the new one
    fn().then((data) => on && setState({ data, loading: false }), (e) => on && setState({ error: String(e?.message ?? e), loading: false }));
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
