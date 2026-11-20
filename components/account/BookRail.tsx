'use client';

import { ArrowDownUp, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { LatencyChip, Skel, usdShort, pct } from '@/components/ui';
import type { BookSort } from '@/lib/client';
import type { Book, BookRow } from '@/lib/types';

export type Status = 'break' | 'flow' | 'behind' | 'ok';
export const LARGE_FLOW = 50_000;

/** Status pill for a row: recon break first, then a large 7-day flow, then performance vs benchmark. */
export function statusOf(r: Pick<BookRow, 'ACCOUNT_ID' | 'NET_FLOW_7D' | 'YTD_RETURN' | 'BENCH_YTD_RETURN'>, breaks: Set<string>): Status {
  if (breaks.has(r.ACCOUNT_ID)) return 'break';
  if (Math.abs(r.NET_FLOW_7D) >= LARGE_FLOW) return 'flow';
  if (r.YTD_RETURN < r.BENCH_YTD_RETURN - 0.02) return 'behind';
  return 'ok';
}
export const STATUS: Record<Status, { label: string; cls: string }> = {
  break: { label: 'Copy mismatch', cls: 'pill-coral' },
  flow: { label: 'Large flow', cls: 'pill-saffron' },
  behind: { label: 'Behind benchmark', cls: 'pill-sky' },
  ok: { label: 'On track', cls: 'pill-quiet' },
};

const SORTS: { k: BookSort; label: string }[] = [
  { k: 'value', label: 'Value' }, { k: 'flow', label: '7-day flow' }, { k: 'ytd', label: 'YTD' }, { k: 'activity', label: 'Recent' },
];

export function BookRail({ book, loading, breaks, selected, onSelect, search, setSearch, sort, setSort }: {
  book?: Book; loading: boolean; breaks: Set<string>; selected?: string; onSelect: (id: string) => void;
  search: string; setSearch: (s: string) => void; sort: BookSort; setSort: (s: BookSort) => void;
}) {
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const rows = useMemo(() => (book?.rows ?? []).map((r) => ({ r, s: statusOf(r, breaks) })), [book, breaks]);
  const counts = useMemo(() => rows.reduce((m, x) => ({ ...m, [x.s]: (m[x.s] ?? 0) + 1 }), {} as Record<string, number>), [rows]);
  const shown = filter === 'all' ? rows : rows.filter((x) => x.s === filter);

  return (
    <section className="panel flex flex-col min-h-0 lg:h-[calc(100vh-148px)] lg:sticky lg:top-[72px]" aria-label="Book of accounts">
      <div className="p-3 border-b space-y-2.5" style={{ borderColor: 'var(--line)' }}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="eyebrow">Book</div>
            <div className="text-[13px]"><b className="mono">{book ? book.total.toLocaleString() : '…'}</b> <span className="text-2">accounts · showing {shown.length}</span></div>
          </div>
          {book && <LatencyChip ms={book.latencyMs} source={book.source} />}
        </div>
        <label className="relative block">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-2" aria-hidden />
          <input className="input !pl-8" placeholder="Search name or account ID" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search accounts" />
        </label>
        <div className="flex items-center gap-2">
          <ArrowDownUp className="w-3.5 h-3.5 text-2 shrink-0" aria-hidden />
          <div className="seg overflow-x-auto" role="group" aria-label="Sort by">
            {SORTS.map((s) => <button key={s.k} aria-pressed={sort === s.k} onClick={() => setSort(s.k)}>{s.label}</button>)}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          <button className={`pill ${filter === 'all' ? 'pill-saffron' : 'pill-quiet'}`} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
          {(['break', 'flow', 'behind'] as Status[]).map((s) => (
            <button key={s} className={`pill ${filter === s ? STATUS[s].cls : 'pill-quiet'}`} aria-pressed={filter === s} onClick={() => setFilter(filter === s ? 'all' : s)}>
              {STATUS[s].label} <span className="mono">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 max-h-[70vh] lg:max-h-none">
        {loading && Array.from({ length: 8 }, (_, i) => <div key={i} className="p-3 border-b" style={{ borderColor: 'var(--line)' }}><Skel className="h-4 w-2/3 mb-2" /><Skel className="h-3 w-1/3" /></div>)}
        {!loading && shown.length === 0 && <div className="p-6 text-center text-sm text-2">No accounts match. Clear the search or the status filter.</div>}
        {!loading && shown.map(({ r, s }) => (
          <button key={r.ACCOUNT_ID} className="rail-row" aria-current={selected === r.ACCOUNT_ID} onClick={() => onSelect(r.ACCOUNT_ID)}>
            <span className="font-medium truncate">{r.ACCOUNT_NAME}</span>
            <span className="mono text-right">{usdShort(r.MARKET_VALUE)}</span>
            <span className="text-[12px] text-2 truncate"><span className="mono">{r.ACCOUNT_ID}</span> · {r.ACCOUNT_TYPE}</span>
            <span className="text-[12px] mono text-right" style={{ color: r.YTD_RETURN >= 0 ? 'var(--mint)' : 'var(--coral)' }}>{pct(r.YTD_RETURN)}</span>
            {s !== 'ok' && <span className="col-span-2 pt-1"><span className={`pill ${STATUS[s].cls}`}>{STATUS[s].label}{s === 'flow' && <span className="mono">{usdShort(r.NET_FLOW_7D)}</span>}</span></span>}
          </button>
        ))}
      </div>
    </section>
  );
}
