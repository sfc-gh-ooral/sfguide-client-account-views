'use client';

// Before vs after: the duplicate reporting-database path and the single-source path, with the
// reconciliation break the copy introduced and a human-in-the-loop action to route it.
import { ArrowRight, Download, Flag } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePersona } from '@/components/Shell';
import { Card, ErrorBox, Kpi, PoweredBy, ScopeBadge } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { fetchRecon } from '@/lib/client';

const BEFORE = ['Warehouse', 'Nightly ETL job', 'Reporting database', 'Reconciliation job', 'Account API'];
const AFTER = ['Snowflake: dynamic tables → interactive tables', 'Account API (Next.js route, pooled connections)'];

function Flow({ steps, extra }: { steps: string[]; extra?: Set<string> }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`flow-box ${extra?.has(s) ? 'extra' : ''}`}>{s}</div>
          {i < steps.length - 1 && <ArrowRight className="w-4 h-4 muted" aria-hidden />}
        </div>
      ))}
    </div>
  );
}

export default function Architecture() {
  const { persona } = usePersona();
  const recon = useAsync(() => fetchRecon(persona), [persona]);
  const [flags, setFlags] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<{ id: string; note: string } | null>(null);
  useEffect(() => { setFlags(JSON.parse(window.localStorage.getItem('cav-flags') ?? '{}')); }, []);
  const saveFlag = () => {
    if (!draft) return;
    const next = { ...flags, [draft.id]: draft.note || 'Flagged for operations review' };
    setFlags(next); window.localStorage.setItem('cav-flags', JSON.stringify(next)); setDraft(null);
  };
  const r = recon.data;
  const exportCsv = () => {
    if (!r) return;
    const csv = ['account_id,serving_positions,copy_positions,flag'].concat(r.breaks.map((b) => `${b.ACCOUNT_ID},${b.SERVING_POSITIONS},${b.COPY_POSITIONS},"${(flags[b.ACCOUNT_ID] ?? '').replace(/"/g, '""')}"`)).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'reconciliation-breaks.csv'; a.click();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Architecture compare</h1>
        <p className="text-sm text-2 max-w-3xl">The same account screens, served two ways. The duplicate path copies warehouse data into a separate reporting database every night; the single-source path serves the screens straight from Snowflake.</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Before: duplicate reporting stack">
          <Flow steps={BEFORE} extra={new Set(['Nightly ETL job', 'Reporting database', 'Reconciliation job'])} />
          <ul className="text-sm text-2 mt-4 space-y-1 list-disc pl-5">
            <li><strong>5</strong> moving parts, 3 of them only there to copy and check data (dashed).</li>
            <li>Freshness: last load {r ? `${r.copyLoadedAt}, from the ${r.copySourceAsOf} close` : '…'}.</li>
            <li>Load status: {r ? <span style={{ color: 'var(--warning)' }}>{r.copyStatus}</span> : '…'}</li>
          </ul>
        </Card>
        <Card title="After: serve from Snowflake" right={<><PoweredBy>Dynamic Tables</PoweredBy><PoweredBy>interactive warehouse</PoweredBy></>}>
          <Flow steps={AFTER} />
          <ul className="text-sm text-2 mt-4 space-y-1 list-disc pl-5">
            <li><strong>2</strong> moving parts. The serving tables are built from the same tables analytics uses.</li>
            <li>Freshness: target lag {r?.servingTargetLag ?? '1 hour'}{r?.servingRefreshedAt ? `; last dynamic table refresh ${r.servingRefreshedAt}` : ''}.</li>
            <li>No copy to reconcile: position counts come from one source.</li>
          </ul>
        </Card>
      </div>

      {recon.error && <ErrorBox error={recon.error} />}
      {r && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 stagger">
            <Kpi label="Breaks, whole copy" value={String(r.totalBreaks)} sub="accounts whose position count differs" />
            <Kpi label="Breaks in your book" value={String(r.breaks.length)} sub={persona} />
            <Kpi label="Breaks, single source" value="0" sub="nothing to reconcile" />
            <Kpi label="Source" value={r.source === 'live' ? 'Live' : 'Captured'} sub={r.source === 'live' ? 'RECON_BREAKS view, just now' : 'from a live run'} />
          </div>

          <Card title="Reconciliation breaks: reporting copy vs single source" right={<><ScopeBadge advisor={persona} />
            <button className="btn" onClick={exportCsv} disabled={!r.breaks.length}><Download className="w-4 h-4" aria-hidden />Export CSV</button></>}>
            {r.breaks.length === 0 ? (
              <p className="text-sm text-2">No breaks in this advisor’s book on this synthetic data set. The {r.totalBreaks} breaks in the copy belong to other books; switch to Dana to see them.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table w-full text-sm">
                  <thead><tr><th className="text-left">Account</th><th className="text-right">Single source</th><th className="text-right">Reporting copy</th><th className="text-left">Action</th></tr></thead>
                  <tbody>{r.breaks.map((b) => (
                    <tr key={b.ACCOUNT_ID}>
                      <td><Link className="underline underline-offset-2" href={`/?account=${b.ACCOUNT_ID}`}>{b.ACCOUNT_ID}</Link></td>
                      <td className="text-right tabular">{b.SERVING_POSITIONS} positions</td>
                      <td className="text-right tabular" style={{ color: 'var(--negative)' }}>{b.COPY_POSITIONS} positions</td>
                      <td>{flags[b.ACCOUNT_ID]
                        ? <span className="text-xs" style={{ color: 'var(--positive)' }}>Flagged: {flags[b.ACCOUNT_ID]}</span>
                        : <button className="btn !py-1 text-xs" onClick={() => setDraft({ id: b.ACCOUNT_ID, note: '' })}><Flag className="w-3.5 h-3.5" aria-hidden />Flag for operations</button>}</td>
                    </tr>))}
                  </tbody>
                </table>
              </div>
            )}
            {draft && (
              <div className="mt-3 card p-3 space-y-2">
                <label className="text-sm font-medium" htmlFor="flag-note">Note for operations on {draft.id}</label>
                <input id="flag-note" className="field" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="e.g. Client statement showed 8 positions; confirm batch 7 reload" />
                <div className="flex gap-2"><button className="btn btn-primary" onClick={saveFlag}>Save flag</button><button className="btn" onClick={() => setDraft(null)}>Cancel</button></div>
                <p className="text-[11px] muted">Saved in this browser only. In production, route it to your case or ticketing system.</p>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
