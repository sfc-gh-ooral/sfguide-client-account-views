'use client';

import { Activity, Play } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAppState } from '@/components/AppState';
import { ChartTip, Panel, Powered, Steps, int, latClass, useCountUp } from '@/components/ui';
import { SAMPLE_LOAD_TESTS, TRACE, runLoadTest } from '@/lib/client';
import type { LoadProfile, LoadTestResult } from '@/lib/types';

const PROFILES: { k: LoadProfile; label: string; hint: string }[] = [
  { k: 'peak', label: 'Market-open replay', hint: 'The seeded trace’s 09:00–10:30 curve, compressed into the run' },
  { k: 'burst', label: 'Burst', hint: 'A quarter of the sessions, all of them for the middle third, then a quarter' },
  { k: 'steady', label: 'Steady', hint: 'Every session for the whole run' },
];
const STEPS = [
  'Opening pooled connections to the interactive warehouse',
  'Picking 2,000 accounts across four advisor books',
  'Running the four account-page query shapes with bound parameters',
  'Computing p50, p95 and p99 from every round trip',
];

function Rung({ label, ms, note }: { label: string; ms: number; note?: string }) {
  const v = useCountUp(ms);
  return (
    <div className="kpi">
      <div className="eyebrow">{label}</div>
      <div className={`kpi-val mono ${latClass(ms)}`}><b style={{ fontWeight: 600, color: ms < 150 ? 'var(--mint)' : ms < 600 ? 'var(--saffron)' : 'var(--coral)' }}>{Math.round(v)}</b><span className="text-[13px] text-2 ml-1">ms</span></div>
      {note && <div className="text-[12px] text-2">{note}</div>}
    </div>
  );
}

function TraceChart() {
  const data = TRACE.minutes.filter((_, i) => i % 3 === 0);
  return (
    <Panel eyebrow="Planted story · peak hour" title={<>A trading day of advisor sessions <span className="text-2 font-normal">· peak <span className="mono">{TRACE.peak.sessions}</span> at {TRACE.peak.t}, median {TRACE.median}</span></>}
      right={<span className="pill pill-quiet mono">seed {TRACE.seed}</span>}>
      <div className="h-[180px] p-2 pr-4">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, left: 0, right: 4, bottom: 0 }}>
            <defs><linearGradient id="trFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--saffron)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--saffron)" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid stroke="var(--grid)" strokeDasharray="2 4" vertical={false} />
            <ReferenceArea x1={TRACE.burst.start} x2={TRACE.burst.end} fill="var(--coral)" fillOpacity={0.12} stroke="none" label={{ value: 'market open', position: 'insideTopRight', fill: 'var(--coral)', fontSize: 11 }} />
            <XAxis dataKey="t" tickLine={false} axisLine={false} interval={39} />
            <YAxis tickLine={false} axisLine={false} width={40} />
            <Tooltip content={<ChartTip fmt={(v) => `${v} sessions`} />} />
            <Area type="monotone" dataKey="sessions" name="Active sessions" stroke="var(--saffron)" strokeWidth={1.5} fill="url(#trFill)" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="px-4 pb-3 text-[12px] text-2">Synthetic, from <span className="mono">scripts/generate-data.mjs</span>. The market-open profile replays this window’s shape, scaled so its peak equals the sessions you choose.</p>
    </Panel>
  );
}

function Results({ r }: { r: LoadTestResult }) {
  const p95 = r.p95;
  return (
    <div className="space-y-4 fade-up">
      <section className="panel">
        <header className="panel-head flex-wrap">
          <div><div className="eyebrow">Result · {PROFILES.find((p) => p.k === r.profile)?.label}</div>
            <h2 className="panel-title">{r.sessions} sessions for {r.seconds} s · <span className="mono">{int(r.queries)}</span> queries · {r.errors} errors</h2></div>
          <div className="flex gap-2 flex-wrap items-center">
            <span className="pill pill-quiet mono">{r.source === 'live' ? `live · ${r.warehouse} · ${r.warehouseSize}` : `captured ${r.capturedAt} · ${r.warehouse} · ${r.warehouseSize}`}</span>
            <Powered by="Interactive warehouse" />
          </div>
        </header>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <Rung label="p50" ms={r.p50} /><Rung label="p95" ms={r.p95} /><Rung label="p99" ms={r.p99} /><Rung label="max" ms={r.max} />
          <div className="kpi"><div className="eyebrow">Throughput</div><div className="kpi-val mono">{r.qps}<span className="text-[13px] text-2 ml-1">q/s</span></div></div>
          <div className="kpi"><div className="eyebrow">Warehouse time</div><div className="kpi-val mono">{r.seconds}<span className="text-[13px] text-2 ml-1">s</span></div><div className="text-[12px] text-2">billed hourly, see <Link className="underline" href="/cost">Cost</Link></div></div>
        </div>
        <p className="px-4 py-2.5 border-t text-[12px] text-2" style={{ borderColor: 'var(--line)' }}>
          Data volume: {r.rowsScanned}. Latency is the round trip from the app server, so it includes the network to Snowflake. Interactive warehouses bill per hour with a one-hour minimum on each resume, so a short run’s credits are the hour it falls in.
        </p>
      </section>
      <div className="grid xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4">
        <Panel eyebrow="Latency under load" title="p50 and p95 per second, with active sessions">
          <div className="h-[260px] p-2 pr-4">
            <ResponsiveContainer>
              <ComposedChart data={r.timeline} margin={{ top: 8, left: 0, right: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--grid)" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="t" tickLine={false} axisLine={false} tickFormatter={(v) => `${v}s`} />
                <YAxis yAxisId="ms" tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${v}`} />
                <YAxis yAxisId="s" orientation="right" tickLine={false} axisLine={false} width={30} />
                <Tooltip content={<ChartTip fmt={(v, n) => (n === 'Active sessions' ? `${v}` : `${v} ms`)} />} />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
                <Area yAxisId="s" type="stepAfter" dataKey="active" name="Active sessions" stroke="none" fill="var(--sky)" fillOpacity={0.14} />
                <Line yAxisId="ms" type="monotone" dataKey="p50" name="p50" stroke="var(--mint)" strokeWidth={1.75} dot={false} />
                <Line yAxisId="ms" type="monotone" dataKey="p95" name="p95" stroke="var(--saffron)" strokeWidth={1.75} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel eyebrow="Distribution" title="Every round trip, bucketed">
          <div className="h-[260px] p-2 pr-4">
            <ResponsiveContainer>
              <BarChart data={r.histogram.filter((h, i, a) => h.n > 0 || a.slice(i).some((x) => x.n > 0))} margin={{ top: 8, left: 0, right: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--grid)" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="le" tickLine={false} axisLine={false} tickFormatter={(v) => `≤${v}`} />
                <YAxis tickLine={false} axisLine={false} width={44} />
                <Tooltip content={<ChartTip fmt={(v) => `${int(v)} queries`} />} labelFormatter={(v) => `≤ ${v} ms`} />
                <Bar dataKey="n" name="Queries" radius={[3, 3, 0, 0]}>
                  {r.histogram.map((h) => <Cell key={h.le} fill={h.le > p95 ? 'var(--coral)' : 'var(--mint)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="px-4 pb-3 text-[12px] text-2">Coral buckets are above this run’s p95.</p>
        </Panel>
      </div>
    </div>
  );
}

export default function LoadLab() {
  const { live } = useAppState();
  const [sessions, setSessions] = useState(16);
  const [seconds, setSeconds] = useState(30);
  const [profile, setProfile] = useState<LoadProfile>('peak');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<LoadTestResult | undefined>(SAMPLE_LOAD_TESTS.find((t) => t.profile === 'peak' && t.sessions === 16));
  const [history, setHistory] = useState<LoadTestResult[]>([]);

  const run = async () => {
    setRunning(true); setError(undefined);
    try { const r = await runLoadTest(sessions, seconds, profile); setResult(r); setHistory((h) => [r, ...h].slice(0, 8)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setRunning(false); }
  };
  const runs = [...history, ...SAMPLE_LOAD_TESTS.filter((t) => !history.includes(t))];

  return (
    <div className="space-y-4">
      <div>
        <div className="eyebrow">Load lab</div>
        <h1 className="text-[26px] font-semibold leading-tight">Does the account page stay fast at market open?</h1>
        <p className="text-[13px] text-2 mt-0.5 max-w-3xl">Run concurrent simulated advisor sessions against the serving tables and read the percentiles. {live ? 'Live mode runs real queries on your interactive warehouse.' : 'Sample mode replays the closest run captured live.'}</p>
      </div>
      <div className="grid xl:grid-cols-[380px_1fr] gap-4 items-start">
        <Panel eyebrow="Run" title="Configure the load" bodyClass="p-4 space-y-4">
          <div>
            <div className="flex justify-between text-[12.5px] mb-1.5"><label htmlFor="sess" className="text-2">Concurrent sessions</label><span className="mono font-semibold">{sessions}</span></div>
            <input id="sess" type="range" min={4} max={32} step={4} value={sessions} onChange={(e) => setSessions(+e.target.value)} className="w-full accent-[var(--saffron)]" />
            <div className="flex justify-between mono text-[10.5px] text-2"><span>4</span><span>32</span></div>
          </div>
          <div>
            <div className="text-[12.5px] text-2 mb-1.5">Duration</div>
            <div className="seg" role="group" aria-label="Duration">{[20, 30].map((s) => <button key={s} aria-pressed={seconds === s} onClick={() => setSeconds(s)}>{s} s</button>)}</div>
          </div>
          <fieldset>
            <legend className="text-[12.5px] text-2 mb-1.5">Traffic profile</legend>
            <div className="space-y-1.5">
              {PROFILES.map((p) => (
                <label key={p.k} className="flex gap-2.5 p-2.5 rounded-lg border cursor-pointer" style={{ borderColor: profile === p.k ? 'var(--saffron)' : 'var(--line)', background: profile === p.k ? 'var(--saffron-soft)' : 'transparent' }}>
                  <input type="radio" name="profile" className="mt-0.5 accent-[var(--saffron)]" checked={profile === p.k} onChange={() => setProfile(p.k)} />
                  <span><span className="font-medium text-[13px]">{p.label}</span><span className="block text-[12px] text-2">{p.hint}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <button className="btn btn-primary w-full !h-10" onClick={run} disabled={running}><Play className="w-4 h-4" aria-hidden />{running ? 'Running…' : live ? `Run live for ${seconds} s` : 'Replay captured run'}</button>
          {running && <div className="pt-1"><Steps steps={STEPS} expectMs={live ? seconds * 1000 : 4800} done={false} /></div>}
          {error && <div role="alert" className="text-sm" style={{ color: 'var(--coral)' }}>{error}</div>}
        </Panel>
        <div className="space-y-4 min-w-0">
          <TraceChart />
          {result && <Results r={result} />}
        </div>
      </div>
      <Panel eyebrow="Run log" title="Runs in this session and captured runs" right={<Activity className="w-4 h-4 text-2" aria-hidden />}>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Source</th><th>Profile</th><th className="num">Sessions</th><th className="num">Queries</th><th className="num">q/s</th><th className="num">p50</th><th className="num">p95</th><th className="num">p99</th><th className="num">Errors</th><th /></tr></thead>
            <tbody>{runs.map((r, i) => (
              <tr key={`${r.startedAt}-${i}`} style={r === result ? { background: 'var(--saffron-soft)' } : undefined}>
                <td><span className={`pill ${r.source === 'live' ? 'pill-mint' : 'pill-quiet'}`}>{r.source}</span></td>
                <td>{PROFILES.find((p) => p.k === r.profile)?.label}</td>
                <td className="num mono">{r.sessions}</td><td className="num mono">{int(r.queries)}</td><td className="num mono">{r.qps}</td>
                <td className="num mono">{r.p50}</td><td className="num mono">{r.p95}</td><td className="num mono">{r.p99}</td><td className="num mono">{r.errors}</td>
                <td className="text-right"><button className="btn !h-7" onClick={() => setResult(r)}>View</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
