'use client';

import { ArrowLeft, CalendarClock, GitCompareArrows } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { BookRail, STATUS, statusOf } from '@/components/account/BookRail';
import { ActivityFeed, CallPrep, Holdings, Performance, Waterfall } from '@/components/account/Widgets';
import { useAppState } from '@/components/AppState';
import { ErrorBox, LatencyChip, Powered, Skel, pct, useCountUp, usd, usdShort } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { type BookSort, fetchAccount, fetchBook, fetchRecon } from '@/lib/client';
import { ADVISORS } from '@/lib/personas';
import type { AccountPage } from '@/lib/types';

function Kpi({ label, value, fmt, sub, tone }: { label: string; value: number; fmt: (n: number) => string; sub?: React.ReactNode; tone?: string }) {
  const v = useCountUp(value);
  return (
    <div className="kpi">
      <div className="eyebrow">{label}</div>
      <div className="kpi-val mt-0.5" style={tone ? { color: tone } : undefined}>{fmt(v)}</div>
      {sub && <div className="text-[12px] text-2 mt-0.5">{sub}</div>}
    </div>
  );
}

function AccountHeader({ page, breaks, onBack }: { page: AccountPage; breaks: Set<string>; onBack: () => void }) {
  const s = page.summary!;
  const st = statusOf(s, breaks);
  const vsBench = s.YTD_RETURN - s.BENCH_YTD_RETURN;
  return (
    <section className="panel fade-up">
      <div className="p-4 flex flex-col md:flex-row md:items-start gap-3">
        <button className="btn lg:hidden self-start" onClick={onBack}><ArrowLeft className="w-4 h-4" aria-hidden />Book</button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[22px] font-semibold">{s.ACCOUNT_NAME}</h1>
            {st !== 'ok' && <span className={`pill ${STATUS[st].cls}`}>{STATUS[st].label}</span>}
          </div>
          <div className="text-[12.5px] text-2 mt-1 flex flex-wrap gap-x-3 gap-y-1">
            <span className="mono">{s.ACCOUNT_ID}</span><span>{s.ACCOUNT_TYPE}</span><span>{s.RISK_PROFILE} risk</span>
            <span className="inline-flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" aria-hidden />Opened {s.OPENED_ON}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap"><LatencyChip ms={page.timings.summary} source={page.source} /><Powered by="Interactive warehouse" /></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 border-t" style={{ borderColor: 'var(--line)' }}>
        <Kpi label="Market value" value={s.MARKET_VALUE} fmt={(n) => usd(n)} sub={`${s.POSITION_COUNT} positions`} />
        <Kpi label="YTD return" value={s.YTD_RETURN} fmt={(n) => pct(n, 2)} tone={s.YTD_RETURN >= 0 ? 'var(--mint)' : 'var(--coral)'}
          sub={<>benchmark {pct(s.BENCH_YTD_RETURN, 2)} · <span style={{ color: vsBench >= 0 ? 'var(--mint)' : 'var(--coral)' }}>{pct(vsBench, 2)}</span></>} />
        <Kpi label="Net flow · 7 days" value={s.NET_FLOW_7D} fmt={(n) => usdShort(n)} tone={Math.abs(s.NET_FLOW_7D) >= 50_000 ? 'var(--saffron)' : undefined} sub="deposits minus withdrawals" />
        <Kpi label="Last activity" value={0} fmt={() => s.LAST_ACTIVITY_TS.slice(5)} sub={`net flows 2y ${usdShort(s.NET_FLOWS_2Y)}`} />
      </div>
      {st === 'break' && (
        <div className="px-4 py-2.5 border-t text-[12.5px] flex flex-wrap items-center gap-2" style={{ borderColor: 'var(--line)', background: 'var(--coral-soft)' }}>
          <span>The nightly reporting copy holds fewer positions for this account than Snowflake does. This page reads the single source.</span>
          <Link href="/architecture" className="inline-flex items-center gap-1 underline font-medium"><GitCompareArrows className="w-3.5 h-3.5" aria-hidden />See the reconciliation</Link>
        </div>
      )}
    </section>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading account">
      <div className="panel p-4 space-y-3"><Skel className="h-6 w-1/2" /><Skel className="h-4 w-1/3" /><div className="grid grid-cols-4 gap-4 pt-2">{[0, 1, 2, 3].map((i) => <Skel key={i} className="h-12" />)}</div></div>
      <div className="grid xl:grid-cols-2 gap-4"><div className="panel p-4"><Skel className="h-40" /></div><div className="panel p-4"><Skel className="h-40" /></div></div>
      <div className="panel p-4"><Skel className="h-56" /></div>
    </div>
  );
}

export default function AccountDesk() {
  const { advisor, live, setLastTimings } = useAppState();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sort, setSort] = useState<BookSort>('value');
  const [selected, setSelected] = useState<string>();
  const [showDetail, setShowDetail] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDebounced(search), 250); return () => clearTimeout(t); }, [search]);

  const ready = live !== undefined;
  const book = useAsync(() => (ready ? fetchBook(advisor, debounced, sort) : new Promise<never>(() => {})), [advisor, debounced, sort, ready]);
  const recon = useAsync(() => (ready ? fetchRecon(advisor) : new Promise<never>(() => {})), [advisor, ready]);
  const breaks = useMemo(() => new Set(recon.data?.breaks.map((b) => b.ACCOUNT_ID) ?? []), [recon.data]);

  // Open the advisor's planted story account first.
  useEffect(() => { setSelected(ADVISORS[advisor].storyAccount); setShowDetail(false); }, [advisor]);
  const account = useAsync(() => (ready && selected ? fetchAccount(advisor, selected) : new Promise<never>(() => {})), [advisor, selected, ready]);
  useEffect(() => { if (account.data) setLastTimings(account.data.timings); }, [account.data, setLastTimings]);

  const st = book.data?.stats;
  const a = ADVISORS[advisor];
  return (
    <div className="space-y-4">
      <section className="flex flex-col xl:flex-row xl:items-end gap-3">
        <div className="flex-1 min-w-0">
          <div className="eyebrow">Account desk · {a.branch}</div>
          <h1 className="text-[26px] font-semibold leading-tight">{a.name}<span className="text-2 font-normal">’s book</span></h1>
          <p className="text-[13px] text-2 mt-0.5">Every widget reads Snowflake directly, scoped to <span className="mono">{advisor}</span>, and shows how long it took.</p>
        </div>
        <div className="panel grid grid-cols-2 sm:grid-cols-4 xl:min-w-[640px]">
          {st ? <>
            <Kpi label="Accounts" value={st.accounts} fmt={(n) => Math.round(n).toLocaleString()} sub="in this book" />
            <Kpi label="Book value" value={st.aum} fmt={usdShort} sub="current holdings" />
            <Kpi label="Avg YTD" value={st.avgYtd} fmt={(n) => pct(n, 2)} tone={st.avgYtd >= 0 ? 'var(--mint)' : 'var(--coral)'} sub="simple average" />
            <Kpi label="Copy mismatches" value={breaks.size} fmt={(n) => Math.round(n).toString()} tone={breaks.size ? 'var(--coral)' : 'var(--mint)'} sub="vs reporting copy" />
          </> : [0, 1, 2, 3].map((i) => <div key={i} className="kpi"><Skel className="h-3 w-16 mb-2" /><Skel className="h-6 w-24" /></div>)}
        </div>
      </section>

      {book.error && <div className="panel"><ErrorBox message={book.error} onRetry={book.reload} /></div>}

      <div className="grid lg:grid-cols-[360px_1fr] gap-4 items-start">
        <div className={showDetail ? 'hidden lg:block' : ''}>
          <BookRail book={book.data} loading={book.loading} breaks={breaks} selected={selected}
            onSelect={(id) => { setSelected(id); setShowDetail(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            search={search} setSearch={setSearch} sort={sort} setSort={setSort} />
        </div>
        <div className={`min-w-0 space-y-4 ${showDetail ? '' : 'hidden lg:block'}`}>
          {account.loading && <DetailSkeleton />}
          {account.error && <div className="panel"><ErrorBox message={account.error} onRetry={account.reload} /></div>}
          {account.data?.summary && (
            <>
              <AccountHeader page={account.data} breaks={breaks} onBack={() => setShowDetail(false)} />
              <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
                <Waterfall page={account.data} />
                <CallPrep advisor={advisor} page={account.data} live={!!live} />
              </div>
              <Holdings page={account.data} />
              <div className="grid xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-4">
                <Performance page={account.data} />
                <ActivityFeed page={account.data} />
              </div>
            </>
          )}
          {account.data && !account.data.summary && <div className="panel p-6 text-sm text-2">This account isn’t in {a.name}’s book. Each advisor sees only their own accounts.</div>}
        </div>
      </div>
    </div>
  );
}
