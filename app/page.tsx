'use client';

// Advisor account page: the screen end users see. Book explorer on the left, then the account's
// summary, holdings, activity, and performance, each with the latency of its own query.
import { FileText, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Reasoning } from '@/components/Reasoning';
import { usePersona } from '@/components/Shell';
import { Card, ErrorBox, Kpi, LatencyChip, Markdown, PoweredBy, SampleAiBadge, ScopeBadge, money, pct } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { fetchAccount, fetchBook, fetchBrief } from '@/lib/client';
import { ADVISORS } from '@/lib/personas';
import type { AiBrief, PerfPoint } from '@/lib/types';

function cumulative(points: PerfPoint[]) {
  let a = 1, b = 1;
  return points.map((p) => { a *= 1 + p.RETURN_PCT; b *= 1 + p.BENCHMARK_PCT; return { m: p.MONTH_END.slice(0, 7), account: +((a - 1) * 100).toFixed(2), benchmark: +((b - 1) * 100).toFixed(2) }; });
}

export default function AccountPage() {
  const { persona } = usePersona();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [account, setAccount] = useState(ADVISORS[persona].storyAccount);
  useEffect(() => {
    // Deep link from the architecture screen (?account=AC-…) on first load; otherwise the advisor's story account.
    const linked = new URLSearchParams(window.location.search).get('account');
    if (linked) window.history.replaceState(null, '', window.location.pathname);
    setAccount(linked && /^AC-\d{6}$/.test(linked) ? linked : ADVISORS[persona].storyAccount); setQ(''); setDebounced('');
  }, [persona]);
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 250); return () => clearTimeout(t); }, [q]);

  const book = useAsync(() => fetchBook(persona, debounced), [persona, debounced]);
  const page = useAsync(async () => { const t0 = performance.now(); const p = await fetchAccount(persona, account); return { ...p, pageMs: Math.round(performance.now() - t0) }; }, [persona, account]);
  const [brief, setBrief] = useState<{ loading?: boolean; data?: AiBrief; error?: string }>({});
  useEffect(() => setBrief({}), [persona, account]);
  const askBrief = () => { setBrief({ loading: true }); fetchBrief(persona, account).then((data) => setBrief({ data }), (e) => setBrief({ error: String(e.message ?? e) })); };

  const p = page.data;
  const s = p?.summary;
  const chart = p ? cumulative(p.performance) : [];
  const alloc = p ? Object.entries(p.holdings.reduce<Record<string, number>>((m, h) => ({ ...m, [h.ASSET_CLASS]: (m[h.ASSET_CLASS] ?? 0) + h.MARKET_VALUE }), {})) : [];
  const widgetMax = p ? Math.max(...Object.values(p.timings)) : 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <Card title="Your book" right={<LatencyChip ms={book.data?.latencyMs} source={book.data?.source} />} className="lg:sticky lg:top-20 self-start">
        <label className="flex items-center gap-2 rounded-lg border px-2 py-1.5 mb-2" style={{ borderColor: 'var(--border)' }}>
          <Search className="w-4 h-4 muted" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search account or name" aria-label="Search accounts"
            className="bg-transparent outline-none text-sm w-full" />
        </label>
        <div className="text-[11px] muted mb-2">{book.data ? `${book.data.total.toLocaleString()} accounts${book.data.source === 'captured' ? ` (${book.data.rows.length} bundled)` : ''} · by market value` : '…'}</div>
        {book.error && <ErrorBox error={book.error} />}
        <ul className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
          {book.data?.rows.map((r) => (
            <li key={r.ACCOUNT_ID}>
              <button onClick={() => setAccount(r.ACCOUNT_ID)} aria-current={r.ACCOUNT_ID === account ? 'true' : undefined}
                className={`w-full text-left rounded-lg px-2 py-1.5 text-sm ${r.ACCOUNT_ID === account ? 'book-active' : 'hover:bg-[var(--surface-2)]'}`}>
                <div className="flex justify-between gap-2"><span className="truncate font-medium">{r.ACCOUNT_NAME}</span><span className="tabular">{money(r.MARKET_VALUE)}</span></div>
                <div className="flex justify-between text-[11px] muted"><span>{r.ACCOUNT_ID} · {r.ACCOUNT_TYPE}</span><span>{pct(r.YTD_RETURN)}</span></div>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <div className="space-y-5 min-w-0">
        {page.error && <ErrorBox error={page.error} />}
        {p && !s && <ErrorBox error={`${account} isn't in ${ADVISORS[persona].name}'s book. The API binds the advisor ID on every query, so nothing is returned.`} />}
        {s && (
          <>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-xl font-bold tracking-tight">{s.ACCOUNT_NAME}</h1>
                <div className="text-sm muted">{s.ACCOUNT_ID} · {s.ACCOUNT_TYPE} · {s.RISK_PROFILE} · opened {s.OPENED_ON}</div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <ScopeBadge advisor={persona} />
                <PoweredBy>interactive tables</PoweredBy>
                <span className="text-xs muted" title="Slowest widget query; the four run in parallel">
                  Page data in {widgetMax} ms ({p.source === 'live' ? 'live' : 'captured'})
                </span>
              </div>
            </div>

            <Card title="Summary" right={<LatencyChip ms={p.timings.summary} source={p.source} />}>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 stagger">
                <Kpi label="Market value" value={money(s.MARKET_VALUE)} sub={`as of ${p.holdings[0]?.AS_OF_DATE ?? ''}`} />
                <Kpi label="YTD return" value={pct(s.YTD_RETURN, 2)} sub="Jan–Oct 2026" />
                <Kpi label="Positions" value={String(s.POSITION_COUNT)} sub="from the single source" />
                <Kpi label="Last activity" value={s.LAST_ACTIVITY_TS.slice(5, 10).replace('-', '/')} sub={s.LAST_ACTIVITY_TS.slice(11)} />
              </div>
            </Card>

            <div className="grid gap-5 xl:grid-cols-2">
              <Card title="Holdings" right={<LatencyChip ms={p.timings.holdings} source={p.source} />}>
                <div className="flex gap-1 mb-3 h-2 rounded-full overflow-hidden" aria-label="Allocation by asset class">
                  {alloc.map(([k, v], i) => <span key={k} title={`${k}: ${money(v)}`} style={{ width: `${(v / s.MARKET_VALUE) * 100}%`, background: `var(--chart-${i + 1})` }} />)}
                </div>
                <div className="flex gap-3 flex-wrap text-[11px] muted mb-2">{alloc.map(([k, v], i) => <span key={k}><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: `var(--chart-${i + 1})` }} />{k} {((v / s.MARKET_VALUE) * 100).toFixed(0)}%</span>)}</div>
                <div className="overflow-x-auto">
                  <table className="data-table w-full text-sm">
                    <thead><tr><th className="text-left">Security</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Value</th></tr></thead>
                    <tbody>{p.holdings.map((h) => (
                      <tr key={h.SECURITY_ID}><td><div className="font-medium">{h.SECURITY_NAME}</div><div className="text-[11px] muted">{h.SECURITY_ID} · {h.ASSET_CLASS}</div></td>
                        <td className="text-right tabular">{h.QUANTITY.toLocaleString()}</td><td className="text-right tabular">${h.PRICE.toFixed(2)}</td><td className="text-right tabular">{money(h.MARKET_VALUE)}</td></tr>))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card title="Activity" right={<LatencyChip ms={p.timings.activity} source={p.source} />}>
                <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {p.activity.slice(0, 12).map((a) => (
                    <li key={a.ACTIVITY_ID} className="py-2 flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0"><div className="font-medium">{a.ACTIVITY_TYPE}{a.SECURITY_ID && !['Deposit', 'Withdrawal', 'Fee', 'Interest'].includes(a.ACTIVITY_TYPE) ? ` · ${a.SECURITY_ID}` : ''}</div>
                        <div className="text-[11px] muted">{a.ACTIVITY_TS}</div></div>
                      <div className={`tabular ${a.ACTIVITY_TYPE === 'Withdrawal' || a.ACTIVITY_TYPE === 'Fee' ? 'text-[var(--negative)]' : ''}`}>{a.ACTIVITY_TYPE === 'Withdrawal' || a.ACTIVITY_TYPE === 'Fee' ? '−' : ''}{money(a.AMOUNT)}</div>
                    </li>))}
                </ul>
              </Card>
            </div>

            <Card title="Performance: cumulative return vs benchmark, 24 months" right={<LatencyChip ms={p.timings.performance} source={p.source} />}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="m" tick={{ fontSize: 11, fill: 'var(--muted)' }} interval={3} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} unit="%" width={44} />
                    <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12 }} formatter={(v) => `${v}%`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="account" name="Account" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.15} strokeWidth={2} />
                    <Area type="monotone" dataKey="benchmark" name="Benchmark" stroke="var(--chart-4)" fill="var(--chart-4)" fillOpacity={0.05} strokeWidth={2} strokeDasharray="4 3" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Call prep brief" right={brief.data ? (brief.data.source === 'sample' ? <SampleAiBadge /> : <><PoweredBy>AI_COMPLETE</PoweredBy><span className="text-[11px] muted">{brief.data.model} · {brief.data.latencyMs.toLocaleString()} ms</span></>) : <PoweredBy>Cortex AI</PoweredBy>}>
              {!brief.loading && !brief.data && (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm text-2">Summarize this account for a client call from the same rows shown above. The advisor reviews it; nothing is sent to the client.</p>
                  <button className="btn btn-primary" onClick={askBrief}><FileText className="w-4 h-4" aria-hidden />Draft brief</button>
                </div>
              )}
              {brief.loading && <Reasoning kind="brief" />}
              {brief.error && <ErrorBox error={brief.error} />}
              {brief.data && <div className="ai-panel"><Markdown text={brief.data.text} /><p className="text-[11px] muted mt-2">Draft for advisor review. Not investment advice.</p></div>}
            </Card>
          </>
        )}
        {page.loading && !p && <div className="card p-6 text-sm muted">Loading account…</div>}
      </div>
    </div>
  );
}
