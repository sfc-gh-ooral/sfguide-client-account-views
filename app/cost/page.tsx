'use client';

// Cost model: every number is an input the reader controls. The page does arithmetic only and
// makes no savings claim of its own.
import { useEffect, useState } from 'react';
import { Card, Kpi } from '@/components/ui';

type Inputs = Record<keyof typeof FIELDS, string>;
const FIELDS = {
  dbMonthly: { label: 'Reporting database: monthly cost (instances, storage, backups)', unit: '$/month', group: 'before' },
  etlMonthly: { label: 'Copy pipeline: monthly compute and tooling', unit: '$/month', group: 'before' },
  reconHours: { label: 'Engineer time on loads and reconciliation breaks', unit: 'hours/month', group: 'before' },
  hourlyRate: { label: 'Loaded engineer cost', unit: '$/hour', group: 'both' },
  creditPrice: { label: 'Snowflake price per credit (your contract)', unit: '$/credit', group: 'after' },
  iwhCreditsPerHour: { label: 'Interactive warehouse credits per hour, per cluster (your size)', unit: 'credits/hour', group: 'after' },
  iwhHoursPerDay: { label: 'Hours per day the interactive warehouse runs', unit: 'hours/day', group: 'after' },
  clusters: { label: 'Average clusters running', unit: 'clusters', group: 'after' },
  refreshCreditsPerDay: { label: 'Dynamic and interactive table refresh credits', unit: 'credits/day', group: 'after' },
  afterOpsHours: { label: 'Engineer time on the serving layer', unit: 'hours/month', group: 'after' },
} as const;
const EMPTY = Object.fromEntries(Object.keys(FIELDS).map((k) => [k, ''])) as Inputs;
const KEY = 'cav-cost-inputs';
const n = (s: string) => (Number.isFinite(Number(s)) && s.trim() !== '' ? Number(s) : 0);
const usd = (x: number) => `$${Math.round(x).toLocaleString()}`;

export default function Cost() {
  const [v, setV] = useState<Inputs>(EMPTY);
  useEffect(() => { const s = window.localStorage.getItem(KEY); if (s) setV({ ...EMPTY, ...JSON.parse(s) }); }, []);
  const set = (k: keyof Inputs, x: string) => { const next = { ...v, [k]: x }; setV(next); window.localStorage.setItem(KEY, JSON.stringify(next)); };
  const filled = Object.values(v).filter((x) => x.trim() !== '').length;
  const before = n(v.dbMonthly) + n(v.etlMonthly) + n(v.reconHours) * n(v.hourlyRate);
  const after = (n(v.iwhCreditsPerHour) * n(v.clusters) * n(v.iwhHoursPerDay) * 30 + n(v.refreshCreditsPerDay) * 30) * n(v.creditPrice) + n(v.afterOpsHours) * n(v.hourlyRate);
  const field = (k: keyof Inputs) => (
    <label key={k} className="block text-sm">{FIELDS[k].label}
      <span className="flex items-center gap-2 mt-1"><input className="field" inputMode="decimal" value={v[k]} onChange={(e) => set(k, e.target.value)} placeholder="enter a value" aria-label={FIELDS[k].label} />
        <span className="text-xs muted whitespace-nowrap">{FIELDS[k].unit}</span></span>
    </label>
  );
  const group = (g: string) => (Object.keys(FIELDS) as (keyof Inputs)[]).filter((k) => FIELDS[k].group === g || (g === 'before' && FIELDS[k].group === 'both')).map(field);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Cost model</h1>
        <p className="text-sm text-2 max-w-3xl">Compare the duplicate reporting stack with serving from Snowflake using your own numbers. Nothing is prefilled: the page only adds up what you enter, and saves it in this browser. Take credit rates from your contract and the Snowflake consumption table; the load test and the README give measured run times for sizing hours.</p>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Before: reporting database path">{<div className="space-y-3">{group('before')}</div>}</Card>
        <Card title="After: serve from Snowflake">{<div className="space-y-3">{group('after')}</div>}</Card>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Kpi label="Before, per month" value={filled ? usd(before) : '—'} sub="database + pipeline + people" />
        <Kpi label="After, per month" value={filled ? usd(after) : '—'} sub="compute + refresh + people" />
        <Kpi label="Difference" value={filled ? `${before - after >= 0 ? '' : '−'}${usd(Math.abs(before - after))}` : '—'} sub={filled ? (before >= after ? 'before minus after' : 'after costs more with these inputs') : 'enter your numbers'} />
        <Kpi label="Inputs filled" value={`${filled} / ${Object.keys(FIELDS).length}`} />
      </div>
      <p className="text-xs muted">Illustrative arithmetic, not a quote. Leave out costs that don’t change, and add analytics-side warehouse costs to both sides if they differ.</p>
    </div>
  );
}
