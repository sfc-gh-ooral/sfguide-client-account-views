'use client';

// Cost model: every number is an input the reader controls. The page does arithmetic only and
// makes no savings claim of its own.
import { Eraser, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTip, Panel } from '@/components/ui';

const FIELDS = {
  dbMonthly: { label: 'Reporting database: instances, storage, backups', unit: '$/month', group: 'before' },
  etlMonthly: { label: 'Copy pipeline: compute and tooling', unit: '$/month', group: 'before' },
  reconHours: { label: 'Engineer time on loads and reconciliation breaks', unit: 'hours/month', group: 'before' },
  hourlyRate: { label: 'Loaded engineer cost (used on both sides)', unit: '$/hour', group: 'before' },
  creditPrice: { label: 'Snowflake price per credit (your contract)', unit: '$/credit', group: 'after' },
  iwhCreditsPerHour: { label: 'Interactive warehouse credits per hour per cluster (your size, from the consumption table)', unit: 'credits/hour', group: 'after' },
  iwhHoursPerDay: { label: 'Hours per day the interactive warehouse runs', unit: 'hours/day', group: 'after' },
  clusters: { label: 'Average clusters running', unit: 'clusters', group: 'after' },
  refreshCreditsPerDay: { label: 'Dynamic and interactive table refresh credits', unit: 'credits/day', group: 'after' },
  afterOpsHours: { label: 'Engineer time on the serving layer', unit: 'hours/month', group: 'after' },
} as const;
type K = keyof typeof FIELDS;
type Inputs = Record<K, string>;
const KEYS = Object.keys(FIELDS) as K[];
const EMPTY = Object.fromEntries(KEYS.map((k) => [k, ''])) as Inputs;
// Round numbers that only show how the arithmetic works. Not an estimate for any firm.
// They are chosen so both sides tie at 10 hours/day, so the placeholder fill favours neither architecture.
const PLACEHOLDER: Inputs = { dbMonthly: '2000', etlMonthly: '500', reconHours: '5', hourlyRate: '100', creditPrice: '3', iwhCreditsPerHour: '1', iwhHoursPerDay: '10', clusters: '1', refreshCreditsPerDay: '10', afterOpsHours: '12' };
const STORE = 'qs-cost-inputs';
const n = (s: string) => (s.trim() !== '' && Number.isFinite(Number(s)) ? Number(s) : 0);
const usd = (x: number) => `${x < 0 ? '−' : ''}$${Math.round(Math.abs(x)).toLocaleString()}`;

function model(v: Inputs, hours = n(v.iwhHoursPerDay)) {
  const people = n(v.hourlyRate);
  const before = { database: n(v.dbMonthly), pipeline: n(v.etlMonthly), people: n(v.reconHours) * people };
  const after = {
    serving: n(v.iwhCreditsPerHour) * n(v.clusters) * hours * 30 * n(v.creditPrice),
    refresh: n(v.refreshCreditsPerDay) * 30 * n(v.creditPrice),
    people: n(v.afterOpsHours) * people,
  };
  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
  return { before, after, beforeTotal: sum(before), afterTotal: sum(after) };
}

export default function Cost() {
  const [v, setV] = useState<Inputs>(EMPTY);
  const [placeholder, setPlaceholder] = useState(false);
  useEffect(() => { const s = window.localStorage.getItem(STORE); if (s) setV({ ...EMPTY, ...JSON.parse(s) }); }, []);
  const save = (next: Inputs, isPlaceholder = false) => { setV(next); setPlaceholder(isPlaceholder); window.localStorage.setItem(STORE, JSON.stringify(next)); };
  const set = (k: K, x: string) => save({ ...v, [k]: x }, false);
  const filled = KEYS.filter((k) => v[k].trim() !== '').length;
  const m = model(v);
  const bars = [
    { side: 'Reporting copy', Database: m.before.database, Pipeline: m.before.pipeline, People: m.before.people },
    { side: 'Snowflake serving', Serving: m.after.serving, Refresh: m.after.refresh, People: m.after.people },
  ];
  const curve = useMemo(() => Array.from({ length: 25 }, (_, h) => ({ h, 'Snowflake serving': Math.round(model(v, h).afterTotal), 'Reporting copy': Math.round(m.beforeTotal) })), [v, m.beforeTotal]);
  const breakEven = curve.find((c, i) => i > 0 && c['Snowflake serving'] > c['Reporting copy'])?.h;
  const diff = m.beforeTotal - m.afterTotal;

  const field = (k: K) => (
    <label key={k} className="block">
      <span className="text-[12.5px] text-2">{FIELDS[k].label}</span>
      <span className="flex items-center gap-2 mt-1">
        <input className="input mono" inputMode="decimal" value={v[k]} onChange={(e) => set(k, e.target.value)} placeholder="your value" aria-label={FIELDS[k].label} />
        <span className="text-[11.5px] text-2 whitespace-nowrap w-[84px]">{FIELDS[k].unit}</span>
      </span>
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="flex-1">
          <div className="eyebrow">Cost model</div>
          <h1 className="text-[26px] font-semibold leading-tight">Your numbers, both architectures</h1>
          <p className="text-[13px] text-2 mt-0.5 max-w-3xl">Nothing is prefilled and nothing is claimed: the page only adds up what you enter, and keeps it in this browser. Take credit rates from your contract and the Snowflake consumption table; use the Load lab to size clusters and hours.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={() => save(PLACEHOLDER, true)}><Wand2 className="w-4 h-4" aria-hidden />Show with placeholder numbers</button>
          <button className="btn" onClick={() => save(EMPTY)}><Eraser className="w-4 h-4" aria-hidden />Clear</button>
        </div>
      </div>
      {placeholder && <div className="panel px-4 py-2.5 text-[12.5px]" style={{ background: 'var(--saffron-soft)' }}><b>Placeholder numbers.</b> Round values that show how the model works. They are not an estimate for any firm, and they are set so the two sides tie; replace every one with yours.</div>}

      <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)] gap-4 items-start">
        <Panel eyebrow="Before" title="Duplicate reporting database" bodyClass="p-4 space-y-3">{KEYS.filter((k) => FIELDS[k].group === 'before').map(field)}</Panel>
        <Panel eyebrow="After" title="Serve from Snowflake" bodyClass="p-4 space-y-3">{KEYS.filter((k) => FIELDS[k].group === 'after').map(field)}</Panel>
        <div className="space-y-4">
          <section className="panel grid grid-cols-3">
            <div className="kpi"><div className="eyebrow">Before / month</div><div className="kpi-val mono">{filled ? usd(m.beforeTotal) : '—'}</div></div>
            <div className="kpi"><div className="eyebrow">After / month</div><div className="kpi-val mono">{filled ? usd(m.afterTotal) : '—'}</div></div>
            <div className="kpi"><div className="eyebrow">Before − after</div><div className="kpi-val mono" style={{ color: filled ? (diff >= 0 ? 'var(--mint)' : 'var(--coral)') : undefined }}>{filled ? usd(diff) : '—'}</div>
              <div className="text-[11.5px] text-2">{filled ? `${filled} of ${KEYS.length} inputs` : 'enter your numbers'}</div></div>
          </section>
          <Panel eyebrow="Composition" title="Monthly cost by component">
            <div className="h-[220px] p-2 pr-4">
              {filled ? (
                <ResponsiveContainer>
                  <BarChart data={bars} layout="vertical" margin={{ top: 4, left: 8, right: 8, bottom: 0 }}>
                    <CartesianGrid stroke="var(--grid)" strokeDasharray="2 4" horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(x) => `$${(x / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="side" tickLine={false} axisLine={false} width={110} />
                    <Tooltip content={<ChartTip fmt={(x) => usd(x)} />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Database" stackId="a" fill="var(--coral)" /><Bar dataKey="Pipeline" stackId="a" fill="var(--saffron)" />
                    <Bar dataKey="Serving" stackId="a" fill="var(--mint)" /><Bar dataKey="Refresh" stackId="a" fill="var(--sky)" />
                    <Bar dataKey="People" stackId="a" fill="var(--plum)" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-full grid place-items-center text-sm text-2 text-center px-6">Enter values on either side, or use placeholder numbers to see how the model works.</div>}
            </div>
          </Panel>
          <Panel eyebrow="Sensitivity" title={breakEven !== undefined && filled ? <>With these inputs, Snowflake serving costs more beyond <span className="mono">{breakEven - 1}</span> hours/day</> : 'Monthly cost by hours per day the interactive warehouse runs'}>
            <div className="h-[220px] p-2 pr-4">
              {filled ? (
                <ResponsiveContainer>
                  <LineChart data={curve} margin={{ top: 8, left: 0, right: 8, bottom: 0 }}>
                    <CartesianGrid stroke="var(--grid)" strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="h" tickLine={false} axisLine={false} tickFormatter={(h) => `${h}h`} interval={3} />
                    <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(x) => `$${(x / 1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTip fmt={(x) => usd(x)} />} labelFormatter={(h) => `${h} hours/day`} />
                    <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
                    {n(v.iwhHoursPerDay) > 0 && <ReferenceLine x={Math.round(n(v.iwhHoursPerDay))} stroke="var(--ink-2)" strokeDasharray="3 3" label={{ value: 'your input', fill: 'var(--ink-2)', fontSize: 11, position: 'top' }} />}
                    <Line type="monotone" dataKey="Reporting copy" stroke="var(--coral)" strokeWidth={1.75} dot={false} />
                    <Line type="monotone" dataKey="Snowflake serving" stroke="var(--mint)" strokeWidth={1.75} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <div className="h-full grid place-items-center text-sm text-2">The curve appears once you enter values.</div>}
            </div>
          </Panel>
        </div>
      </div>
      <p className="text-[12px] text-2">Illustrative arithmetic, not a quote. Interactive warehouses bill per hour with a one-hour minimum each time they resume, so count whole hours. Leave out costs that don’t change, and add analytics-side warehouse costs to both sides if they differ.</p>
    </div>
  );
}
