'use client';

// Load test: N concurrent simulated sessions run the account-page query shapes against the
// interactive warehouse (Live), or replay a captured live run (Sample).
import { Play } from 'lucide-react';
import { useState } from 'react';
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Bar, Tooltip, XAxis, YAxis } from 'recharts';
import { Reasoning } from '@/components/Reasoning';
import { Card, ErrorBox, Kpi, PoweredBy } from '@/components/ui';
import { CAPTURED_AT, SAMPLE_LOAD_TESTS, runLoadTest } from '@/lib/client';
import type { LoadTestResult } from '@/lib/types';

export default function LoadTest() {
  const [sessions, setSessions] = useState(16);
  const [seconds, setSeconds] = useState(20);
  const [profile, setProfile] = useState<'steady' | 'burst'>('burst');
  const [state, setState] = useState<{ loading?: boolean; data?: LoadTestResult; error?: string }>({ data: SAMPLE_LOAD_TESTS.find((t) => t.profile === 'burst') ? { ...SAMPLE_LOAD_TESTS.find((t) => t.profile === 'burst')!, source: 'captured' } : undefined });
  const run = () => { setState({ loading: true }); runLoadTest(sessions, seconds, profile).then((data) => setState({ data }), (e) => setState({ error: String(e.message ?? e) })); };
  const d = state.data;
  const [rate, setRate] = useState('');
  const credits = d && Number(rate) > 0 ? (d.seconds / 3600) * Number(rate) : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Load test</h1>
        <p className="text-sm text-2 max-w-3xl">Simulate advisors opening account pages at the same time. Each session loops over the four account-page queries (summary, holdings, activity, performance) for random accounts, with bound parameters on pooled connections. The burst profile models a peak hour: a quarter of the sessions, then all of them, then a quarter again.</p>
      </div>

      <Card title="Run settings" right={<PoweredBy>interactive warehouse</PoweredBy>}>
        <div className="grid gap-4 sm:grid-cols-3 items-end">
          <label className="text-sm">Concurrent sessions: <strong>{sessions}</strong>
            <input type="range" min={1} max={32} value={sessions} onChange={(e) => setSessions(+e.target.value)} className="w-full" /></label>
          <label className="text-sm">Duration: <strong>{seconds} s</strong>
            <input type="range" min={10} max={60} step={5} value={seconds} onChange={(e) => setSeconds(+e.target.value)} className="w-full" /></label>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="seg flex" role="group" aria-label="Load profile">
              {(['steady', 'burst'] as const).map((p) => <button key={p} aria-pressed={profile === p} onClick={() => setProfile(p)} className="px-3 py-1.5 text-xs font-medium capitalize">{p === 'burst' ? 'Peak-hour burst' : 'Steady'}</button>)}
            </div>
            <button className="btn btn-primary" onClick={run} disabled={state.loading}><Play className="w-4 h-4" aria-hidden />Run</button>
          </div>
        </div>
        <p className="text-[11px] muted mt-2">Live runs use your interactive warehouse and its one-hour minimum billing period. Sample mode replays the closest captured live run.</p>
      </Card>

      {state.loading && <Reasoning kind="loadtest" />}
      {state.error && <ErrorBox error={state.error} />}
      {d && !state.loading && (
        <>
          <div className="text-xs muted">
            {d.source === 'live' ? 'Live run just now' : `Captured live run (${d.capturedAt ?? CAPTURED_AT})`} · {d.sessions} sessions · {d.seconds} s · {d.profile === 'burst' ? 'peak-hour burst' : 'steady'} · {d.warehouse} ({d.warehouseSize}) · 500,000 accounts, 20M positions, 50M activity rows
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 stagger">
            <Kpi label="p50" value={`${d.p50} ms`} />
            <Kpi label="p95" value={`${d.p95} ms`} />
            <Kpi label="p99" value={`${d.p99} ms`} />
            <Kpi label="Throughput" value={`${d.qps} q/s`} sub={`${d.queries.toLocaleString()} queries`} />
            <Kpi label="Errors" value={String(d.errors)} sub={`max ${d.max} ms`} />
          </div>
          <Card title="Credits for this run">
            <div className="flex flex-wrap items-end gap-4 text-sm">
              <label className="w-56">Your credits per hour for an {d.warehouseSize} interactive warehouse
                <input className="field mt-1" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="from your contract" /></label>
              <div><div className="text-[11px] uppercase tracking-wider muted font-semibold">Estimated credits</div>
                <div className="text-xl font-bold tabular">{credits === null ? '—' : credits.toFixed(4)}</div></div>
              <p className="text-xs muted max-w-md">Run time × your rate. An interactive warehouse bills a minimum of one hour each time it resumes, so a short test on a cold warehouse costs at least one hour. Check actual usage in WAREHOUSE_METERING_HISTORY.</p>
            </div>
          </Card>
          <Card title="Latency and throughput over the run">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={d.timeline} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="t" unit="s" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                  <YAxis yAxisId="ms" tick={{ fontSize: 11, fill: 'var(--muted)' }} unit=" ms" width={56} />
                  <YAxis yAxisId="q" orientation="right" tick={{ fontSize: 11, fill: 'var(--muted)' }} width={40} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="q" dataKey="qps" name="Queries per second" fill="var(--chart-1)" fillOpacity={0.35} />
                  <Line yAxisId="ms" dataKey="p95" name="p95 latency (ms)" stroke="var(--chart-5)" strokeWidth={2} dot={false} />
                  <Line yAxisId="q" dataKey="active" name="Active sessions" stroke="var(--chart-4)" strokeDasharray="4 3" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] muted mt-2">Latency is the round trip from the app server to Snowflake, with the result cache turned off. It depends on network distance, warehouse size, cluster count, and data volume; measure in your own setup.</p>
          </Card>
        </>
      )}
    </div>
  );
}
