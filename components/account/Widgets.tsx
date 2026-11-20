'use client';

import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronUp, ClipboardCheck, RotateCcw, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Area, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTip, LatencyChip, Panel, Powered, SampleAiLabel, Steps, StreamText, int, latClass, pct, usd, usdShort } from '@/components/ui';
import { fetchBrief } from '@/lib/client';
import type { AccountPage, Activity, AiBrief, Holding, PerfPoint, Timings } from '@/lib/types';

const WIDGETS: { k: keyof Timings; label: string; table: string; color: string }[] = [
  { k: 'summary', label: 'Summary', table: 'ACCOUNT_SUMMARY_IT', color: 'var(--saffron)' },
  { k: 'holdings', label: 'Holdings', table: 'HOLDINGS_IT', color: 'var(--mint)' },
  { k: 'activity', label: 'Activity', table: 'ACTIVITY_IT', color: 'var(--sky)' },
  { k: 'performance', label: 'Performance', table: 'PERFORMANCE_IT', color: 'var(--plum)' },
];

/** The four widget queries run in parallel; the page is ready when the slowest returns. */
export function Waterfall({ page }: { page: AccountPage }) {
  const max = Math.max(...Object.values(page.timings));
  const scale = Math.max(100, Math.ceil(max / 100) * 100);
  return (
    <Panel eyebrow="Page assembly" title={<>Ready in <span className="mono" style={{ color: max < 600 ? 'var(--mint)' : 'var(--coral)' }}>{max} ms</span></>}
      right={<><Powered by="Interactive tables" /><span className="pill pill-quiet mono">{page.source === 'live' ? page.warehouse : 'captured'}</span></>}>
      <div className="p-4 space-y-2.5">
        {WIDGETS.map((w) => (
          <div key={w.k} className="grid grid-cols-[88px_1fr_64px] sm:grid-cols-[104px_1fr_150px_64px] items-center gap-3 text-[12.5px]">
            <span className="text-2">{w.label}</span>
            <div className="wf-track"><span className="wf-bar" style={{ width: `${(page.timings[w.k] / scale) * 100}%`, background: w.color }} /></div>
            <span className="mono text-[11px] text-2 hidden sm:block truncate">{w.table}</span>
            <span className={`mono text-right ${latClass(page.timings[w.k])}`}><b style={{ color: 'inherit' }}>{page.timings[w.k]} ms</b></span>
          </div>
        ))}
        <div className="grid grid-cols-[88px_1fr_64px] sm:grid-cols-[104px_1fr_150px_64px] gap-3 mono text-[10.5px] text-2">
          <span /><div className="flex justify-between"><span>0</span><span>{scale / 2}</span><span>{scale} ms</span></div>
        </div>
        <p className="text-[12px] text-2 pt-1">
          {page.source === 'live' ? 'Measured on the app server for this request: pooled connection, bound parameters, result cache off.'
            : `Captured from a live run on ${page.capturedAt}: XSMALL interactive warehouse, 500,000 accounts. Replayed here, not measured.`}
        </p>
      </div>
    </Panel>
  );
}

const CLASS_COLORS: Record<string, string> = { Equity: 'var(--saffron)', 'Fixed Income': 'var(--sky)', Alternatives: 'var(--plum)' };
type HSort = 'MARKET_VALUE' | 'QUANTITY' | 'SECURITY_NAME';

export function Holdings({ page }: { page: AccountPage }) {
  const [sort, setSort] = useState<{ k: HSort; dir: 1 | -1 }>({ k: 'MARKET_VALUE', dir: -1 });
  const total = page.holdings.reduce((s, h) => s + h.MARKET_VALUE, 0);
  const alloc = Object.entries(page.holdings.reduce((m, h) => ({ ...m, [h.ASSET_CLASS]: (m[h.ASSET_CLASS] ?? 0) + h.MARKET_VALUE }), {} as Record<string, number>))
    .map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const rows = [...page.holdings].sort((a, b) => {
    const x = a[sort.k], y = b[sort.k];
    return (typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number)) * sort.dir;
  });
  const th = (k: HSort, label: string, num = true) => (
    <th className={num ? 'num' : ''} aria-sort={sort.k === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => setSort({ k, dir: sort.k === k ? (-sort.dir as 1 | -1) : -1 })}>
        {label}{sort.k === k && (sort.dir === 1 ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </button>
    </th>
  );
  return (
    <Panel eyebrow="Holdings" title={`${page.holdings.length} positions · ${usdShort(total)}`}
      right={<LatencyChip ms={page.timings.holdings} source={page.source} />}>
      <div className="grid md:grid-cols-[200px_1fr]">
        <div className="p-4 md:border-r flex md:flex-col items-center gap-4" style={{ borderColor: 'var(--line)' }}>
          <div className="w-[130px] h-[130px] shrink-0">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={alloc} dataKey="value" nameKey="name" innerRadius={42} outerRadius={62} paddingAngle={2} stroke="none" isAnimationActive>
                  {alloc.map((a) => <Cell key={a.name} fill={CLASS_COLORS[a.name] ?? 'var(--mint)'} />)}
                </Pie>
                <Tooltip content={<ChartTip fmt={(v) => `${usdShort(v)} · ${((v / total) * 100).toFixed(0)}%`} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1.5 text-[12.5px] w-full">
            {alloc.map((a) => (
              <li key={a.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CLASS_COLORS[a.name] ?? 'var(--mint)' }} aria-hidden />
                <span className="text-2">{a.name}</span><span className="mono ml-auto">{((a.value / total) * 100).toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr>{th('SECURITY_NAME', 'Fund', false)}<th>Class</th>{th('QUANTITY', 'Qty')}<th className="num">Price</th>{th('MARKET_VALUE', 'Value')}<th className="num">Weight</th></tr></thead>
            <tbody>
              {rows.map((h: Holding) => (
                <tr key={h.SECURITY_ID}>
                  <td><div className="font-medium">{h.SECURITY_NAME}</div><div className="mono text-[11px] text-2">{h.SECURITY_ID}</div></td>
                  <td><span className="pill pill-quiet">{h.ASSET_CLASS}</span></td>
                  <td className="num mono">{int(h.QUANTITY)}</td>
                  <td className="num mono">{usd(h.PRICE, 2)}</td>
                  <td className="num mono">{usd(h.MARKET_VALUE)}</td>
                  <td className="num">
                    <div className="flex items-center justify-end gap-2">
                      <span className="hidden sm:block w-14 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--panel-2)' }}><span className="block h-full" style={{ width: `${(h.MARKET_VALUE / total) * 100}%`, background: CLASS_COLORS[h.ASSET_CLASS] }} /></span>
                      <span className="mono">{((h.MARKET_VALUE / total) * 100).toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  );
}

const INFLOW = new Set(['Deposit', 'Dividend', 'Interest', 'Sell']);
const TYPE_PILL: Record<string, string> = { Deposit: 'pill-mint', Withdrawal: 'pill-coral', Buy: 'pill-sky', Sell: 'pill-saffron', Dividend: 'pill-mint', Interest: 'pill-mint', Fee: 'pill-quiet' };

export function ActivityFeed({ page }: { page: AccountPage }) {
  const types = ['All', ...Array.from(new Set(page.activity.map((a) => a.ACTIVITY_TYPE))).sort()];
  const [t, setT] = useState('All');
  const rows = t === 'All' ? page.activity : page.activity.filter((a) => a.ACTIVITY_TYPE === t);
  return (
    <Panel eyebrow="Activity" title="Latest 25 events" right={<LatencyChip ms={page.timings.activity} source={page.source} />}>
      <div className="px-4 pt-3 flex gap-1.5 flex-wrap" role="group" aria-label="Filter activity">
        {types.map((x) => <button key={x} className={`pill ${t === x ? 'pill-saffron' : 'pill-quiet'}`} aria-pressed={t === x} onClick={() => setT(x)}>{x}</button>)}
      </div>
      <ol className="p-2 max-h-[360px] overflow-y-auto">
        {rows.map((a: Activity) => {
          const inflow = INFLOW.has(a.ACTIVITY_TYPE);
          const big = a.AMOUNT >= 100_000;
          return (
            <li key={a.ACTIVITY_ID} className="flex items-center gap-3 px-2 py-2 rounded-md" style={big ? { background: 'var(--saffron-soft)' } : undefined}>
              <span className="w-7 h-7 rounded-md grid place-items-center shrink-0" style={{ background: inflow ? 'var(--mint-soft)' : 'var(--panel-2)', color: inflow ? 'var(--mint)' : 'var(--ink-2)' }} aria-hidden>
                {inflow ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className={`pill ${TYPE_PILL[a.ACTIVITY_TYPE] ?? 'pill-quiet'}`}>{a.ACTIVITY_TYPE}</span>{big && <span className="pill pill-saffron">Large</span>}</div>
                <div className="mono text-[11px] text-2 mt-0.5 truncate">{a.ACTIVITY_TS}{a.SECURITY_ID ? ` · ${a.SECURITY_ID}` : ''}</div>
              </div>
              <span className="mono text-right" style={{ color: inflow ? 'var(--mint)' : 'var(--ink)' }}>{inflow ? '+' : '−'}{usd(a.AMOUNT, 2)}</span>
            </li>
          );
        })}
        {rows.length === 0 && <li className="p-4 text-sm text-2 text-center">No {t.toLowerCase()} events in the latest 25.</li>}
      </ol>
    </Panel>
  );
}

export function Performance({ page }: { page: AccountPage }) {
  const data = useMemo(() => {
    let a = 100, b = 100;
    return page.performance.map((p: PerfPoint) => { a *= 1 + p.RETURN_PCT; b *= 1 + p.BENCHMARK_PCT; return { m: p.MONTH_END.slice(0, 7), Account: +a.toFixed(2), Benchmark: +b.toFixed(2) }; });
  }, [page.performance]);
  const last = data[data.length - 1];
  return (
    <Panel eyebrow="Performance" title={<>Growth of $100 over 24 months{last && <span className="text-2 font-normal"> · <span className="mono" style={{ color: last.Account >= last.Benchmark ? 'var(--mint)' : 'var(--coral)' }}>{(last.Account - last.Benchmark).toFixed(1)} pts</span> vs benchmark</span>}</>}
      right={<LatencyChip ms={page.timings.performance} source={page.source} />}>
      <div className="h-[260px] p-2 pr-4">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 12, left: 0, right: 4, bottom: 0 }}>
            <defs><linearGradient id="acctFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--saffron)" stopOpacity={0.32} /><stop offset="100%" stopColor="var(--saffron)" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid stroke="var(--grid)" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="m" tickLine={false} axisLine={false} interval={5} />
            <YAxis tickLine={false} axisLine={false} width={40} domain={['dataMin - 2', 'dataMax + 2']} tickFormatter={(v) => Math.round(v).toString()} />
            <Tooltip content={<ChartTip fmt={(v) => `$${v.toFixed(2)}`} />} />
            <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="Account" stroke="var(--saffron)" strokeWidth={1.75} fill="url(#acctFill)" dot={false} />
            <Line type="monotone" dataKey="Benchmark" stroke="var(--sky)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

const BRIEF_STEPS = [
  'Reading the account from interactive tables, scoped to your advisor ID',
  'Assembling 10 holdings, the latest 10 events and 12 months of returns',
  'Drafting the brief with AI_COMPLETE on the standard warehouse',
  'Tagging each point with the widget it came from',
];
const NOTE_KEY = (adv: string, acct: string) => `qs-note:${adv}:${acct}`;

/** AI call prep plus the advisor's own decision: edit, then mark the account prepared. */
export function CallPrep({ advisor, page, live }: { advisor: string; page: AccountPage; live: boolean }) {
  const account = page.summary!.ACCOUNT_ID;
  const [state, setState] = useState<{ running: boolean; brief?: AiBrief; error?: string }>({ running: false });
  const [streamed, setStreamed] = useState(false);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState<{ at: string; text: string } | null>(null);

  useEffect(() => {
    setState({ running: false }); setStreamed(false); setNote('');
    const s = window.localStorage.getItem(NOTE_KEY(advisor, account));
    setSaved(s ? JSON.parse(s) : null);
  }, [advisor, account]);

  const run = async () => {
    setState({ running: true }); setStreamed(false);
    try { setState({ running: false, brief: await fetchBrief(advisor, account) }); }
    catch (e) { setState({ running: false, error: e instanceof Error ? e.message : String(e) }); }
  };
  const save = () => {
    const v = { at: new Date().toLocaleString(), text: note.trim() };
    window.localStorage.setItem(NOTE_KEY(advisor, account), JSON.stringify(v));
    setSaved(v); setNote('');
  };

  return (
    <section className="panel ai-panel fade-up" aria-label="Call prep">
      <header className="panel-head flex-wrap">
        <div><div className="eyebrow" style={{ color: 'var(--plum)' }}>AI call prep</div><h2 className="panel-title">Brief for the next client call</h2></div>
        <div className="flex items-center gap-2 flex-wrap">
          {state.brief?.source === 'sample' && <SampleAiLabel />}
          {state.brief?.source === 'live' && <span className="lat lat-mid"><b>{(state.brief.latencyMs / 1000).toFixed(1)} s</b><span className="src">live · {state.brief.model}</span></span>}
          <Powered by="Cortex AI_COMPLETE" />
        </div>
      </header>
      <div className="p-4 space-y-4">
        {!state.running && !state.brief && !state.error && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-[13px] text-2 flex-1">Three points (allocation, recent activity, performance vs benchmark) and one question to ask, drafted only from the rows on this page. You review and decide what to keep.</p>
            <button className="btn btn-ai shrink-0" onClick={run}><Sparkles className="w-4 h-4" aria-hidden />Draft brief</button>
          </div>
        )}
        {state.running && <Steps steps={BRIEF_STEPS} expectMs={live ? 9000 : 6000} done={false} />}
        {state.error && <div role="alert" className="text-sm" style={{ color: 'var(--coral)' }}>{state.error} <button className="underline ml-2" onClick={run}>Try again</button></div>}
        {state.brief && (
          <>
            <StreamText text={state.brief.text} onDone={() => setStreamed(true)} />
            {streamed && (
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-2 fade-up">
                <span>Sources:</span>
                {state.brief.citations.map((c) => <span key={c.id} className="inline-flex items-center gap-1"><span className="cite !ml-0">{c.id}</span>{c.label}</span>)}
                <button className="ml-auto inline-flex items-center gap-1 underline" onClick={run}><RotateCcw className="w-3 h-3" aria-hidden />Redraft</button>
              </div>
            )}
          </>
        )}
        <div className="pt-3 border-t" style={{ borderColor: 'var(--line)' }}>
          <label className="eyebrow block mb-1.5" htmlFor="prep-note">Your prep note</label>
          <textarea id="prep-note" className="input !h-20 py-2 resize-none" placeholder="What you'll cover. Saved in this browser only." value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button className="btn btn-primary" onClick={save} disabled={!note.trim() && !state.brief}><ClipboardCheck className="w-4 h-4" aria-hidden />Mark call prepared</button>
            {saved && <span className="pill pill-mint">Prepared {saved.at}</span>}
          </div>
          {saved?.text && <p className="text-[12.5px] text-2 mt-2 italic">“{saved.text}”</p>}
        </div>
      </div>
    </section>
  );
}
